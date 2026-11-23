using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Settings;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Tasks;

public static class TaskEndpoints
{
    private static readonly string[] Fields = ["title", "descriptionMarkdown", "columnId", "priority", "dueDate", "dueTime", "startDate", "tagIds", "relatedDashboardItemId"];
    public static void MapTasks(this RouteGroupBuilder api)
    {
        api.MapGet("/tasks/today", async (TaskService service, SettingsService settings) => new { today = await settings.Today(), tasks = await service.Projection("today") }).CacheOutput("hub-data");
        api.MapGet("/tasks/overdue", async (TaskService service, SettingsService settings) => new { today = await settings.Today(), tasks = await service.Projection("overdue") }).CacheOutput("hub-data");
        api.MapGet("/tasks/summary", (TaskService service) => service.Summary()).CacheOutput("hub-data");
        api.MapGet("/tasks", async (HttpRequest request, HubDb db, TaskService service, SettingsService settings) =>
        {
            var q = request.Query; var query = service.Query.AsNoTracking();
            if (!bool.TryParse(q["archived"], out var archived)) archived = false;
            var archivedColumns = await db.Columns.Where(x => x.IsArchived).Select(x => x.Id).ToListAsync();
            query = archived ? query.Where(x => x.IsArchived || archivedColumns.Contains(x.ColumnId)) : query.Where(x => !x.IsArchived && !archivedColumns.Contains(x.ColumnId));
            if (!string.IsNullOrWhiteSpace(q["q"])) { var text = q["q"].ToString(); query = query.Where(x => x.Title.Contains(text) || x.DescriptionMarkdown.Contains(text)); }
            if (Guid.TryParse(q["status"], out var status)) query = query.Where(x => x.ColumnId == status);
            if (Guid.TryParse(q["tag"], out var tag)) query = query.Where(x => x.Tags.Any(t => t.Id == tag));
            if (!string.IsNullOrWhiteSpace(q["priority"])) { var priority = q["priority"].ToString(); query = query.Where(x => x.Priority == priority); }
            if (bool.TryParse(q["completed"], out var completed)) query = completed ? query.Where(x => x.CompletedAt != null) : query.Where(x => x.CompletedAt == null);
            var today = await settings.Today(); var end = today.AddDays(6);
            query = q["due"].ToString() switch
            {
                "today" => query.Where(x => x.CompletedAt == null && x.DueDate <= today),
                "overdue" => query.Where(x => x.CompletedAt == null && x.DueDate < today),
                "next7" => query.Where(x => x.CompletedAt == null && x.DueDate >= today && x.DueDate <= end),
                "none" => query.Where(x => x.DueDate == null), _ => query
            };
            var limit = int.TryParse(q["limit"], out var l) ? Math.Clamp(l, 1, 500) : 200;
            var offset = int.TryParse(q["cursor"], out var c) ? Math.Max(0, c) : 0;
            var count = await query.CountAsync();
            var ordered = q["due"] == "today"
                ? query.OrderByDescending(x => x.Priority == "urgent" ? 4 : x.Priority == "high" ? 3 : x.Priority == "medium" ? 2 : x.Priority == "low" ? 1 : 0).ThenBy(x => x.DueTime == null).ThenBy(x => x.DueTime).ThenBy(x => x.Title)
                : q["sort"].ToString() switch
                {
                    "title" => query.OrderBy(x => x.Title),
                    "priority" => query.OrderByDescending(x => x.Priority == "urgent" ? 4 : x.Priority == "high" ? 3 : x.Priority == "medium" ? 2 : x.Priority == "low" ? 1 : 0),
                    "dueDate" => query.OrderBy(x => x.DueDate == null).ThenBy(x => x.DueDate),
                    _ => query.OrderBy(x => x.SortOrder)
                };
            var tasks = await ordered.ThenBy(x => x.Id).Skip(offset).Take(limit).ToListAsync();
            return new { today, tasks, total = count, nextCursor = offset + limit < count ? (offset + limit).ToString() : null };
        }).CacheOutput("hub-data");
        api.MapGet("/tasks/{id:guid}", (Guid id, TaskService service) => service.Find(id));
        api.MapPost("/tasks", async (JsonElement body, HubDb db, TaskService service) =>
        {
            var task = Validation.Patch(new HubTask(), WithoutCollections(body), Fields); await Collections(db, task, body);
            await service.Validate(task); task.SortOrder = (await db.Tasks.Where(x => x.ColumnId == task.ColumnId).MaxAsync(x => (int?)x.SortOrder) ?? -1) + 1; db.Tasks.Add(task); await db.SaveChangesAsync(); return Results.Created($"/api/v1/tasks/{task.Id}", task);
        });
        api.MapPatch("/tasks/{id:guid}", async (Guid id, JsonElement body, HubDb db, TaskService service) =>
        {
            var task = await service.Find(id); Validation.Version(task, body, true); var previous = task.ColumnId;
            Validation.Patch(task, WithoutCollections(body), Fields); await Collections(db, task, body);
            var target = task.ColumnId; task.ColumnId = previous;
            if (target != previous) await service.Move(task, target, 0);
            await service.Validate(task); db.Entry(task).Property(x => x.UpdatedAt).IsModified = true;
            await db.SaveChangesAsync(); return task;
        });
        api.MapPost("/tasks/{id:guid}/move", async (Guid id, JsonElement body, HubDb db, TaskService service, SettingsService settings) =>
        {
            var task = await service.Find(id); Validation.Version(task, body, true);
            if (body.TryGetProperty("targetColumnId", out var target) && target.GetString() == "today")
            {
                if (task.CompletedAt != null || task.IsArchived) throw new DomainError(422, "Tylko aktywne, nieukończone zadanie można przenieść do Dzisiaj.");
                task.DueDate = await settings.Today();
            }
            else
            {
                var columnId = Validation.Id(body, "targetColumnId");
                if (body.TryGetProperty("targetTaskId", out _))
                    await service.Move(task, columnId, 0, Validation.Id(body, "targetTaskId"), body.TryGetProperty("afterTarget", out var after) && after.ValueKind == JsonValueKind.True);
                else await service.Move(task, columnId, Validation.Index(body));
            }
            await db.SaveChangesAsync(); return new { task, columns = await db.Tasks.Where(x => x.ColumnId == task.ColumnId).OrderBy(x => x.SortOrder).Select(x => new { x.Id, x.SortOrder, x.Version }).ToListAsync() };
        });
        foreach (var action in new[] { "complete", "reopen", "archive", "unarchive", "duplicate" })
            api.MapPost("/tasks/{id:guid}/" + action, async (Guid id, JsonElement body, HubDb db, TaskService service) =>
            {
                var task = await service.Find(id); Validation.Version(task, body, true);
                switch (action)
                {
                    case "complete": await service.Complete(task); break;
                    case "reopen": await service.Reopen(task); break;
                    case "archive": task.IsArchived = true; break;
                    case "unarchive": task.IsArchived = false; await service.Validate(task); break;
                    case "duplicate":
                        var copy = new HubTask { ColumnId = task.ColumnId, Title = task.Title, DescriptionMarkdown = task.DescriptionMarkdown, Priority = task.Priority, DueDate = task.DueDate, DueTime = task.DueTime, StartDate = task.StartDate, RelatedDashboardItemId = task.RelatedDashboardItemId, Tags = [..task.Tags], Checklist = task.Checklist.Select(x => new ChecklistItem { Title = x.Title }).ToList(), Links = task.Links.Select(x => new TaskLink { Title = x.Title, Url = x.Url }).ToList(), SortOrder = await db.Tasks.CountAsync(x => x.ColumnId == task.ColumnId) };
                        await service.Validate(copy); db.Tasks.Add(copy); task = copy; break;
                }
                await db.SaveChangesAsync(); return task;
            });
        api.MapDelete("/tasks/{id:guid}", async (Guid id, int expectedVersion, HubDb db, TaskService service) =>
        {
            var task = await service.Find(id); if (task.Version != expectedVersion) throw new DomainError(409, "Konflikt wersji.", task); db.Tasks.Remove(task); await db.SaveChangesAsync(); return Results.NoContent();
        });
        MapColumns(api);
    }
    private static JsonElement WithoutCollections(JsonElement body) => JsonSerializer.SerializeToElement(body.EnumerateObject().Where(x => x.Name is not ("checklist" or "links")).ToDictionary(x => x.Name, x => x.Value));
    private static async Task Collections(HubDb db, HubTask task, JsonElement body)
    {
        await DashboardEndpoints.SetTags(db, task.Tags, body);
        var isUpdate = db.Entry(task).State != EntityState.Detached;
        if (body.TryGetProperty("checklist", out var checklist))
        {
            var previous = task.Checklist.ToDictionary(x => x.Id);
            var result = new List<ChecklistItem>();
            foreach (var row in checklist.EnumerateArray())
            {
                ChecklistItem item;
                if (row.TryGetProperty("id", out var field) && field.TryGetGuid(out var id))
                    item = previous.GetValueOrDefault(id) ?? throw new DomainError(422, "Nieznana pozycja checklisty.");
                else
                {
                    item = new ChecklistItem { TaskId = task.Id };
                    if (isUpdate) db.Add(item);
                }
                item.Title = row.GetProperty("title").GetString()!;
                item.IsChecked = row.TryGetProperty("isChecked", out var check) && check.GetBoolean();
                result.Add(item);
            }
            if (result.Select(x => x.Id).Distinct().Count() != result.Count) throw new DomainError(422, "Powtórzone ID checklisty.");
            task.Checklist = result;
        }
        if (body.TryGetProperty("links", out var links))
        {
            var previous = task.Links.ToDictionary(x => x.Id);
            var result = new List<TaskLink>();
            foreach (var row in links.EnumerateArray())
            {
                TaskLink link;
                if (row.TryGetProperty("id", out var field) && field.TryGetGuid(out var id))
                    link = previous.GetValueOrDefault(id) ?? throw new DomainError(422, "Nieznany link zadania.");
                else
                {
                    link = new TaskLink { TaskId = task.Id };
                    if (isUpdate) db.Add(link);
                }
                link.Title = row.GetProperty("title").GetString()!;
                link.Url = row.GetProperty("url").GetString()!;
                result.Add(link);
            }
            if (result.Select(x => x.Id).Distinct().Count() != result.Count) throw new DomainError(422, "Powtórzone ID linków.");
            task.Links = result;
        }
    }
    private static void MapColumns(RouteGroupBuilder api)
    {
        string[] fields = ["name", "color", "isDone", "wipLimit", "isArchived"];
        api.MapGet("/task-columns", async (HubDb db) => await db.Columns.OrderBy(x => x.SortOrder).ToListAsync());
        api.MapPost("/task-columns", async (JsonElement body, HubDb db) =>
        {
            var column = Validation.Patch(new TaskColumn(), body, fields); ValidateColumn(column);
            if (await db.Columns.CountAsync() >= 20) throw new DomainError(422, "Limit 20 kolumn.");
            column.SortOrder = (await db.Columns.MaxAsync(x => (int?)x.SortOrder) ?? -1) + 1; db.Columns.Add(column); await db.SaveChangesAsync(); return column;
        });
        api.MapPatch("/task-columns/{id:guid}", async (Guid id, JsonElement body, HubDb db, TimeProvider clock) =>
        {
            var column = await db.Columns.FindAsync(id) ?? throw new DomainError(404, "Nieznana kolumna."); Validation.Version(column, body); var wasDone = column.IsDone;
            Validation.Patch(column, body, fields); ValidateColumn(column);
            if ((!column.IsDone || column.IsArchived) && !await db.Columns.AnyAsync(x => x.Id != id && x.IsDone && !x.IsArchived)) throw new DomainError(422, "Musi istnieć aktywna kolumna ukończonych zadań.");
            if (column.IsArchived && await db.Tasks.AnyAsync(x => x.ColumnId == id && !x.IsArchived)) throw new DomainError(409, "Najpierw przenieś lub zarchiwizuj zadania kolumny.");
            if (wasDone != column.IsDone) foreach (var task in await db.Tasks.Where(x => x.ColumnId == id).ToListAsync()) task.CompletedAt = column.IsDone ? task.CompletedAt ?? clock.GetUtcNow().UtcDateTime : null;
            await db.SaveChangesAsync(); return column;
        });
        api.MapPost("/task-columns/reorder", async (JsonElement body, HubDb db) => { var rows = await db.Columns.ToListAsync(); DashboardEndpoints.Reorder(rows, body); await db.SaveChangesAsync(); return rows; });
        api.MapDelete("/task-columns/{id:guid}", async (Guid id, Guid? moveTasksTo, bool? archiveTasks, HubDb db, TaskService service) =>
        {
            var column = await db.Columns.FindAsync(id) ?? throw new DomainError(404, "Nieznana kolumna.");
            if (column.IsDone && !await db.Columns.AnyAsync(x => x.Id != id && x.IsDone && !x.IsArchived)) throw new DomainError(422, "Nie można usunąć ostatniej kolumny ukończonych zadań.");
            var tasks = await db.Tasks.Where(x => x.ColumnId == id).ToListAsync();
            if (tasks.Count != 0 && moveTasksTo == null && archiveTasks != true) throw new DomainError(409, "Wybierz docelową kolumnę lub archiwizację zadań.");
            if (moveTasksTo == id) throw new DomainError(422, "Wybierz inną kolumnę.");
            if (archiveTasks == true && moveTasksTo == null) { column.IsArchived = true; foreach (var task in tasks) task.IsArchived = true; }
            else { foreach (var task in tasks) await service.Move(task, moveTasksTo!.Value, int.MaxValue); db.Columns.Remove(column); }
            await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
    private static void ValidateColumn(TaskColumn column) { Validation.Text(column.Name, 80, "Nazwa"); Validation.Color(column.Color); if (column.WipLimit is < 1 or > 20000) throw new DomainError(422, "Limit WIP musi być dodatni."); }
}
