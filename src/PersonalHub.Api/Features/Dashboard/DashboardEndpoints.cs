using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Infrastructure.Persistence;

namespace PersonalHub.Api.Features.Dashboard;
public static class DashboardEndpoints
{
    public static void MapDashboard(this RouteGroupBuilder api)
    {
        api.MapGet("/tabs", async (HubDb db) => await db.Tabs.OrderBy(x => x.SortOrder).ToListAsync());
        api.MapGet("/sections", async (Guid? tabId, HubDb db) => await db.Sections.Where(x => tabId == null || x.TabId == tabId).OrderBy(x => x.SortOrder).ToListAsync());
        api.MapGet("/items", async (Guid? sectionId, HubDb db) => await db.Items.Include(x => x.Tags).Where(x => sectionId == null || x.SectionId == sectionId).OrderBy(x => x.SortOrder).ToListAsync());
        MapCrud<DashboardTab>(api, "tabs", ["name", "iconKey", "accentColor", "isHidden"], async (db, x) =>
        {
            Validation.Text(x.Name, 80, "Nazwa"); Validation.Color(x.AccentColor);
            await ValidateIcon(db, x.IconKey);
            if (db.Entry(x).State == EntityState.Detached && await db.Tabs.CountAsync() >= 50) throw new DomainError(422, "Limit 50 zakładek.");
        }, async (db, x, cascade) => { if (!cascade && await db.Sections.AnyAsync(s => s.TabId == x.Id)) throw new DomainError(409, "Zakładka zawiera sekcje. Potwierdź usunięcie zawartości."); });
        MapCrud<DashboardSection>(api, "sections", ["name", "tabId", "description", "iconKey", "accentColor", "isCollapsed", "layoutMode", "desktopColumns", "tabletColumns", "mobileColumns", "widthPercent"], async (db, x) =>
        {
            Validation.Text(x.Name, 80, "Nazwa"); Validation.Text(x.Description, 500, "Opis", false); Validation.Color(x.AccentColor);
            await ValidateIcon(db, x.IconKey);
            if (!await db.Tabs.AnyAsync(t => t.Id == x.TabId)) throw new DomainError(422, "Nieznana zakładka.");
            if (x.WidthPercent is not (25 or 33 or 50 or 66 or 75 or 100)) throw new DomainError(422, "Wybierz szerokość sekcji: 25, 33, 50, 66, 75 lub 100%.");
            if (await db.Sections.CountAsync(s => s.TabId == x.TabId && s.Id != x.Id) >= 100) throw new DomainError(422, "Limit 100 sekcji.");
            if (x.DesktopColumns is < 1 or > 6 || x.TabletColumns is < 1 or > 4 || x.MobileColumns is < 1 or > 2 || x.LayoutMode is not ("grid" or "list")) throw new DomainError(422, "Niepoprawny układ sekcji.");
        }, async (db, x, cascade) => { if (!cascade && await db.Items.AnyAsync(i => i.SectionId == x.Id)) throw new DomainError(409, "Sekcja zawiera karty. Potwierdź usunięcie zawartości."); });
        api.MapPost("/items", async (JsonElement body, HubDb db) =>
        {
            var item = Validation.Patch(new DashboardItem(), body, ItemFields);
            await ValidateItem(db, item); item.SortOrder = (await db.Items.Where(x => x.SectionId == item.SectionId).MaxAsync(x => (int?)x.SortOrder) ?? -1) + 1;
            await SetTags(db, item.Tags, body); db.Items.Add(item); await db.SaveChangesAsync(); return Results.Created($"/api/v1/items/{item.Id}", item);
        });
        api.MapPatch("/items/{id:guid}", async (Guid id, JsonElement body, HubDb db) =>
        {
            var item = await db.Items.Include(x => x.Tags).SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Nie znaleziono karty.");
            Validation.Version(item, body); Validation.Patch(item, body, ItemFields); await ValidateItem(db, item); await SetTags(db, item.Tags, body);
            db.Entry(item).Property(x => x.UpdatedAt).IsModified = true;
            await db.SaveChangesAsync(); return item;
        });
        api.MapDelete("/items/{id:guid}", async (Guid id, HubDb db) => { var item = await db.Items.FindAsync(id) ?? throw new DomainError(404, "Nie znaleziono karty."); db.Items.Remove(item); await db.SaveChangesAsync(); return Results.NoContent(); });
        api.MapPost("/items/{id:guid}/duplicate", async (Guid id, HubDb db) =>
        {
            var item = await db.Items.AsNoTracking().Include(x => x.Tags).SingleOrDefaultAsync(x => x.Id == id) ?? throw new DomainError(404, "Nie znaleziono karty.");
            item.Id = Guid.CreateVersion7(); item.Version = 1; item.CreatedAt = item.UpdatedAt = default;
            await ValidateItem(db, item); item.SortOrder = (await db.Items.Where(x => x.SectionId == item.SectionId).MaxAsync(x => (int?)x.SortOrder) ?? -1) + 1;
            foreach (var tag in item.Tags) db.Attach(tag); db.Items.Add(item); await db.SaveChangesAsync(); return item;
        });
        api.MapPost("/tabs/reorder", async (JsonElement body, HubDb db) => { var rows = await db.Tabs.OrderBy(x => x.SortOrder).ToListAsync(); Reorder(rows, body); await db.SaveChangesAsync(); return rows; });
        api.MapPost("/sections/move", async (JsonElement body, HubDb db) =>
        {
            var item = await db.Sections.FindAsync(Validation.Id(body, "sectionId")) ?? throw new DomainError(404, "Nie znaleziono sekcji.");
            Validation.Version(item, body); var target = Validation.Id(body, "targetTabId");
            if (!await db.Tabs.AnyAsync(x => x.Id == target)) throw new DomainError(422, "Nieznana zakładka.");
            if (target != item.TabId && await db.Sections.CountAsync(x => x.TabId == target) >= 100) throw new DomainError(422, "Limit sekcji.");
            var source = item.TabId; var rows = await db.Sections.Where(x => x.TabId == source || x.TabId == target).OrderBy(x => x.SortOrder).ToListAsync();
            item.TabId = target; Move(rows, item, x => x.TabId, target, Validation.Index(body)); await db.SaveChangesAsync(); return rows;
        });
        api.MapPost("/items/move", async (JsonElement body, HubDb db) =>
        {
            var item = await db.Items.FindAsync(Validation.Id(body, "itemId")) ?? throw new DomainError(404, "Nie znaleziono karty.");
            Validation.Version(item, body); var target = Validation.Id(body, "targetSectionId");
            if (!await db.Sections.AnyAsync(x => x.Id == target)) throw new DomainError(422, "Nieznana sekcja.");
            if (target != item.SectionId && await db.Items.CountAsync(x => x.SectionId == target) >= 200) throw new DomainError(422, "Limit kart.");
            var source = item.SectionId; var rows = await db.Items.Where(x => x.SectionId == source || x.SectionId == target).OrderBy(x => x.SortOrder).ToListAsync();
            item.SectionId = target; Move(rows, item, x => x.SectionId, target, Validation.Index(body)); await db.SaveChangesAsync(); return rows;
        });
        api.MapGet("/tags", async (HubDb db) => await db.Tags.OrderBy(x => x.Name).ToListAsync());
        MapCrud<Tag>(api, "tags", ["name", "color"], async (db, tag) =>
        {
            Validation.Text(tag.Name, 40, "Tag"); Validation.Color(tag.Color);
            if (await db.Tags.AnyAsync(x => x.Name == tag.Name && x.Id != tag.Id)) throw new DomainError(409, "Tag o tej nazwie już istnieje.");
        }, (_, _, _) => Task.CompletedTask);
    }
    private static readonly string[] ItemFields = ["sectionId", "itemType", "title", "url", "description", "iconKey", "accentColor", "openInNewTab", "isFavorite", "tagIds"];
    public static async Task ValidateItem(HubDb db, DashboardItem item)
    {
        Validation.Text(item.Title, 120, "Tytuł"); Validation.Text(item.Description, item.ItemType == "note" ? 5000 : 500, "Opis", false); Validation.Color(item.AccentColor);
        if (item.ItemType is not ("compact-link" or "detailed-link" or "service-card" or "note" or "spacer")) throw new DomainError(422, "Nieznany typ karty.");
        if (item.ItemType is not ("note" or "spacer")) Validation.Url(item.Url); else item.Url = null;
        if (!await db.Sections.AnyAsync(x => x.Id == item.SectionId)) throw new DomainError(422, "Nieznana sekcja.");
        if (await db.Items.CountAsync(x => x.SectionId == item.SectionId && x.Id != item.Id) >= 200) throw new DomainError(422, "Limit 200 kart.");
        await ValidateIcon(db, item.IconKey);
    }
    public static async Task ValidateIcon(HubDb db, string key)
    {
        Validation.Text(key, 120, "Ikona");
        if (key.StartsWith("icon:")) { if (!Guid.TryParse(key[5..], out var id) || !await db.Icons.AnyAsync(x => x.Id == id)) throw new DomainError(422, "Nieznana ikona."); }
        else if (!key.StartsWith("lucide:") && !key.StartsWith("si:")) throw new DomainError(422, "Niepoprawny klucz ikony.");
    }
    public static async Task SetTags(HubDb db, List<Tag> tags, JsonElement body)
    {
        if (!body.TryGetProperty("tagIds", out var field)) return;
        var ids = field.Deserialize<Guid[]>() ?? []; if (ids.Length > 20 || ids.Distinct().Count() != ids.Length) throw new DomainError(422, "Maksymalnie 20 różnych tagów.");
        var found = await db.Tags.Where(x => ids.Contains(x.Id)).ToListAsync(); if (found.Count != ids.Length) throw new DomainError(422, "Nieznany tag.");
        tags.Clear(); tags.AddRange(found);
    }
    public static void Reorder<T>(List<T> rows, JsonElement body) where T : Entity
    {
        var ids = body.GetProperty("orderedIds").Deserialize<Guid[]>() ?? [];
        if (ids.Length != rows.Count || ids.Distinct().Count() != rows.Count || rows.Any(x => !ids.Contains(x.Id))) throw new DomainError(422, "Lista musi zawierać każdy identyfikator dokładnie raz.");
        foreach (var row in rows) SetOrder(row, Array.IndexOf(ids, row.Id));
    }
    public static void Move<T>(List<T> rows, T item, Func<T, Guid> container, Guid target, int index) where T : Entity
    {
        var destination = rows.Where(x => x.Id != item.Id && container(x) == target).ToList(); destination.Insert(Math.Min(index, destination.Count), item);
        foreach (var group in rows.Where(x => x.Id != item.Id && container(x) != target).GroupBy(container)) foreach (var (row, i) in group.Select((x, i) => (x, i))) SetOrder(row, i);
        foreach (var (row, i) in destination.Select((x, i) => (x, i))) SetOrder(row, i);
    }
    private static void SetOrder(Entity row, int i) => row.GetType().GetProperty("SortOrder")!.SetValue(row, i);
    private static void MapCrud<T>(RouteGroupBuilder api, string route, string[] fields, Func<HubDb, T, Task> validate, Func<HubDb, T, bool, Task> beforeDelete) where T : Entity, new()
    {
        api.MapPost("/" + route, async (JsonElement body, HubDb db) =>
        {
            var item = Validation.Patch(new T(), body, fields); await validate(db, item);
            var order = typeof(T).GetProperty("SortOrder");
            if (order != null)
            {
                var rows = db.Set<T>().AsQueryable();
                if (item is DashboardSection section) rows = rows.Where(x => EF.Property<Guid>(x, "TabId") == section.TabId);
                order.SetValue(item, (await rows.MaxAsync(x => (int?)EF.Property<int>(x, "SortOrder")) ?? -1) + 1);
            }
            db.Add(item); await db.SaveChangesAsync(); return Results.Created($"/api/v1/{route}/{item.Id}", item);
        });
        api.MapPatch("/" + route + "/{id:guid}", async (Guid id, JsonElement body, HubDb db) =>
        {
            var item = await db.Set<T>().FindAsync(id) ?? throw new DomainError(404, "Nie znaleziono rekordu.");
            Validation.Version(item, body); Validation.Patch(item, body, fields); await validate(db, item); await db.SaveChangesAsync(); return item;
        });
        api.MapDelete("/" + route + "/{id:guid}", async (Guid id, bool? cascade, HubDb db) =>
        {
            var item = await db.Set<T>().FindAsync(id) ?? throw new DomainError(404, "Nie znaleziono rekordu.");
            await beforeDelete(db, item, cascade == true); db.Remove(item); await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
}
