using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Settings;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Tasks;

public class TaskService(HubDb db, SettingsService settings, TimeProvider clock)
{
    public IQueryable<HubTask> Query => db.Tasks.Include(x => x.Tags).Include(x => x.Checklist.OrderBy(item => item.SortOrder)).Include(x => x.Links.OrderBy(link => link.SortOrder)).AsSplitQuery();
    public async Task<HubTask> Find(Guid id) => await Query.SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Nie znaleziono zadania.");
    public async Task<List<HubTask>> Projection(string view)
    {
        var today = await settings.Today(); var end = today.AddDays(6);
        var columns = await db.Columns.Where(x => !x.IsArchived).Select(x => x.Id).ToListAsync();
        var query = Query.AsNoTracking().Where(x => !x.IsArchived && x.CompletedAt == null && columns.Contains(x.ColumnId));
        query = view switch
        {
            "overdue" => query.Where(x => x.DueDate < today),
            "next7" => query.Where(x => x.DueDate >= today && x.DueDate <= end),
            _ => query.Where(x => x.DueDate <= today)
        };
        return (await query.ToListAsync()).OrderByDescending(x => PriorityRank(x.Priority)).ThenBy(x => x.DueTime == null).ThenBy(x => x.DueTime).ThenBy(x => x.Title, StringComparer.CurrentCultureIgnoreCase).ToList();
    }
    public async Task<object> Summary()
    {
        var today = await settings.Today(); var end = today.AddDays(6);
        var columns = await db.Columns.Where(x => !x.IsArchived).Select(x => x.Id).ToListAsync();
        var query = db.Tasks.Where(x => !x.IsArchived && x.CompletedAt == null && columns.Contains(x.ColumnId));
        return new { today, todayCount = await query.CountAsync(x => x.DueDate == today), overdueCount = await query.CountAsync(x => x.DueDate < today), next7Count = await query.CountAsync(x => x.DueDate >= today && x.DueDate <= end) };
    }
    public async Task Validate(HubTask task)
    {
        Validation.Text(task.Title, 200, "Tytuł"); Validation.Text(task.DescriptionMarkdown, 20000, "Opis", false);
        if (task.Priority is not ("none" or "low" or "medium" or "high" or "urgent")) throw new DomainError(422, "Nieznany priorytet.");
        var column = await db.Columns.FindAsync(task.ColumnId) ?? throw new DomainError(422, "Nieznana kolumna.");
        if (column.IsArchived && !task.IsArchived) throw new DomainError(422, "Kolumna jest w archiwum.");
        if (task.Checklist == null || task.Checklist.Count > 100 || task.Links == null || task.Links.Count > 20) throw new DomainError(422, "Przekroczono limit checklisty lub linków.");
        foreach (var (item, i) in task.Checklist.Select((x, i) => (x, i))) { Validation.Text(item.Title, 200, "Pozycja checklisty"); item.TaskId = task.Id; item.SortOrder = i; }
        foreach (var (item, i) in task.Links.Select((x, i) => (x, i))) { Validation.Text(item.Title, 120, "Nazwa linku"); Validation.Url(item.Url); item.TaskId = task.Id; item.SortOrder = i; }
        if (task.RelatedDashboardItemId != null && !await db.Items.AnyAsync(x => x.Id == task.RelatedDashboardItemId)) throw new DomainError(422, "Nieznana powiązana karta.");
        if (await db.Tasks.CountAsync(x => x.Id != task.Id) >= 20000) throw new DomainError(422, "Limit 20000 zadań.");
        task.CompletedAt = column.IsDone ? task.CompletedAt ?? clock.GetUtcNow().UtcDateTime : null;
    }
    public async Task Move(HubTask task, Guid target, int index, Guid? anchor = null, bool after = false)
    {
        var column = await db.Columns.FindAsync(target) ?? throw new DomainError(422, "Nieznana kolumna.");
        if (column.IsArchived) throw new DomainError(422, "Kolumna jest w archiwum.");
        var source = task.ColumnId;
        var rows = await db.Tasks.Where(x => x.ColumnId == source || x.ColumnId == target).OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync();
        if (anchor != null)
        {
            var destination = rows.Where(x => x.ColumnId == target && x.Id != task.Id).ToList();
            index = destination.FindIndex(x => x.Id == anchor);
            if (index < 0) throw new DomainError(409, "Zadanie docelowe zmieniło pozycję. Odświeżono tablicę.");
            if (after) index++;
        }
        if (column.IsDone && task.CompletedAt == null) { task.LastActiveColumnId = source; task.CompletedAt = clock.GetUtcNow().UtcDateTime; }
        if (!column.IsDone) task.CompletedAt = null;
        task.ColumnId = target;
        Dashboard.DashboardEndpoints.Move(rows, task, x => x.ColumnId, target, index);
    }
    public async Task Complete(HubTask task)
    {
        var target = await db.Columns.Where(x => x.IsDone && !x.IsArchived).OrderBy(x => x.SortOrder).FirstAsync();
        await Move(task, target.Id, 0);
    }
    public async Task Reopen(HubTask task)
    {
        var target = await db.Columns.Where(x => x.Id == task.LastActiveColumnId && !x.IsDone && !x.IsArchived).FirstOrDefaultAsync()
            ?? await db.Columns.Where(x => !x.IsDone && !x.IsArchived).OrderBy(x => x.SortOrder).FirstOrDefaultAsync()
            ?? throw new DomainError(422, "Utwórz aktywną kolumnę, aby otworzyć zadanie.");
        await Move(task, target.Id, 0);
    }
    public static int PriorityRank(string priority) => priority switch { "urgent" => 4, "high" => 3, "medium" => 2, "low" => 1, _ => 0 };
}
