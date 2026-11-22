using System.Collections.Concurrent;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Tasks;
using PersonalHub.Api.Features.Settings;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Backup;

public record ExportDocument(int SchemaVersion, List<DashboardTab> Tabs, List<DashboardSection> Sections, List<DashboardItem> Items, List<Tag> Tags, List<TaskColumn> Columns, List<HubTask> Tasks, List<IconAsset> Icons, Dictionary<string, JsonElement> Settings);
public record PreviewEntry(ExportDocument Document, DateTimeOffset ExpiresAt);
public class PreviewStore { public ConcurrentDictionary<string, PreviewEntry> Entries { get; } = new(); }
public class TransferService(HubDb db, SettingsService settings, BackupService backup, PreviewStore previews, TimeProvider clock)
{
    public async Task<ExportDocument> Export(bool icons = true) => new(1,
        await db.Tabs.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(), await db.Sections.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(),
        await db.Items.AsNoTracking().Include(x => x.Tags).OrderBy(x => x.SortOrder).ToListAsync(), await db.Tags.AsNoTracking().ToListAsync(),
        await db.Columns.AsNoTracking().OrderBy(x => x.SortOrder).ToListAsync(), await db.Tasks.AsNoTracking().Include(x => x.Tags).Include(x => x.Checklist).Include(x => x.Links).AsSplitQuery().OrderBy(x => x.SortOrder).ToListAsync(),
        icons ? await db.Icons.AsNoTracking().ToListAsync() : [], await settings.Read());
    public object Preview(ExportDocument doc)
    {
        foreach (var old in previews.Entries.Where(x => x.Value.ExpiresAt < clock.GetUtcNow()).ToArray()) previews.Entries.TryRemove(old.Key, out _);
        if (previews.Entries.Count >= 5) throw new DomainError(429, "Zbyt wiele podglądów. Poczekaj 10 minut.");
        Validate(doc); var token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
        previews.Entries[token] = new PreviewEntry(doc, clock.GetUtcNow().AddMinutes(10));
        return new { previewToken = token, counts = new { tabs = doc.Tabs.Count, sections = doc.Sections.Count, items = doc.Items.Count, tasks = doc.Tasks.Count, icons = doc.Icons.Count }, errors = Array.Empty<string>() };
    }
    public async Task Commit(string token)
    {
        if (!previews.Entries.TryRemove(token, out var entry) || entry.ExpiresAt < clock.GetUtcNow()) throw new DomainError(422, "Podgląd wygasł lub został już użyty.");
        var d = entry.Document; Validate(d); await backup.Create("pre-import");
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Tasks.ExecuteDeleteAsync(); await db.Items.ExecuteDeleteAsync(); await db.Sections.ExecuteDeleteAsync(); await db.Tabs.ExecuteDeleteAsync(); await db.Columns.ExecuteDeleteAsync(); await db.Tags.ExecuteDeleteAsync(); await db.Icons.ExecuteDeleteAsync(); await db.Settings.ExecuteDeleteAsync();
        db.ChangeTracker.Clear(); var tags = d.Tags.ToDictionary(x => x.Id);
        foreach (var item in d.Items) item.Tags = item.Tags.Select(x => tags[x.Id]).ToList();
        foreach (var task in d.Tasks) task.Tags = task.Tags.Select(x => tags[x.Id]).ToList();
        db.AddRange(d.Icons); db.AddRange(d.Tabs); db.AddRange(d.Sections); db.AddRange(d.Tags); db.AddRange(d.Columns); db.AddRange(d.Items); db.AddRange(d.Tasks);
        await db.SaveChangesAsync(); await settings.Write(d.Settings); await tx.CommitAsync();
    }
    public static void Validate(ExportDocument d)
    {
        if (d == null || d.SchemaVersion != 1 || d.Tabs == null || d.Sections == null || d.Items == null || d.Tags == null || d.Columns == null || d.Tasks == null || d.Icons == null || d.Settings == null) throw new DomainError(422, "Nieobsługiwany lub niekompletny format eksportu.");
        if (d.Tabs.Count > 50 || d.Columns.Count > 20 || d.Tasks.Count > 20000 || d.Tasks.Any(x => x.Checklist == null || x.Links == null)) throw new DomainError(422, "Przekroczone limity lub brakujące kolekcje.");
        var entities = d.Tabs.Cast<Entity>().Concat(d.Sections).Concat(d.Items).Concat(d.Tags).Concat(d.Columns).Concat(d.Tasks).Concat(d.Icons).Concat(d.Tasks.SelectMany(x => x.Checklist)).Concat(d.Tasks.SelectMany(x => x.Links)).ToList();
        if (entities.Any(x => x.Id == Guid.Empty || x.Version < 1) || entities.Select(x => x.Id).Distinct().Count() != entities.Count) throw new DomainError(422, "Niepoprawne lub powtórzone ID.");
        var tabs = d.Tabs.Select(x => x.Id).ToHashSet(); var sections = d.Sections.Select(x => x.Id).ToHashSet(); var items = d.Items.Select(x => x.Id).ToHashSet(); var tags = d.Tags.Select(x => x.Id).ToHashSet(); var columns = d.Columns.ToDictionary(x => x.Id); var icons = d.Icons.Select(x => x.Id).ToHashSet();
        void Icon(string key) { Validation.Text(key, 120, "Ikona"); if (key.StartsWith("icon:") && (!Guid.TryParse(key[5..], out var id) || !icons.Contains(id))) throw new DomainError(422, "Brak powiązanej ikony. Eksportuj z ikonami."); if (!key.StartsWith("icon:") && !key.StartsWith("lucide:") && !key.StartsWith("si:")) throw new DomainError(422, "Niepoprawny klucz ikony."); }
        void Tags(List<Tag> list) { if (list == null || list.Count > 20 || list.Any(x => !tags.Contains(x.Id)) || list.Select(x => x.Id).Distinct().Count() != list.Count) throw new DomainError(422, "Niepoprawne tagi."); }
        foreach (var x in d.Tabs) { Validation.Text(x.Name, 80, "Zakładka"); Validation.Color(x.AccentColor); Icon(x.IconKey); }
        foreach (var x in d.Sections) { Validation.Text(x.Name, 80, "Sekcja"); Validation.Text(x.Description, 500, "Opis", false); Validation.Color(x.AccentColor); Icon(x.IconKey); if (!tabs.Contains(x.TabId) || x.WidthPercent is not (25 or 33 or 50 or 66 or 75 or 100) || d.Sections.Count(s => s.TabId == x.TabId) > 100 || x.DesktopColumns is < 1 or > 6 || x.TabletColumns is < 1 or > 4 || x.MobileColumns is < 1 or > 2 || x.LayoutMode is not ("grid" or "list")) throw new DomainError(422, "Niepoprawna sekcja."); }
        foreach (var x in d.Items) { Validation.Text(x.Title, 120, "Karta"); Validation.Text(x.Description, x.ItemType == "note" ? 5000 : 500, "Opis", false); Validation.Color(x.AccentColor); Icon(x.IconKey); Tags(x.Tags); if (!sections.Contains(x.SectionId) || d.Items.Count(i => i.SectionId == x.SectionId) > 200 || x.ItemType is not ("note" or "spacer" or "compact-link" or "detailed-link" or "service-card")) throw new DomainError(422, "Niepoprawna karta."); if (x.ItemType is not ("note" or "spacer")) Validation.Url(x.Url); else x.Url = null; }
        foreach (var x in d.Tags) { Validation.Text(x.Name, 40, "Tag"); Validation.Color(x.Color); }
        if (d.Tags.Select(x => x.Name.ToUpperInvariant()).Distinct().Count() != d.Tags.Count) throw new DomainError(422, "Powtórzone nazwy tagów.");
        foreach (var x in d.Columns) { Validation.Text(x.Name, 80, "Kolumna"); Validation.Color(x.Color); if (x.WipLimit is < 1 or > 20000) throw new DomainError(422, "Niepoprawny WIP."); }
        if (!d.Columns.Any(x => x.IsDone && !x.IsArchived)) throw new DomainError(422, "Wymagana kolumna ukończonych zadań.");
        foreach (var x in d.Tasks)
        {
            Validation.Text(x.Title, 200, "Zadanie"); Validation.Text(x.DescriptionMarkdown, 20000, "Opis", false); Tags(x.Tags);
            if (!columns.TryGetValue(x.ColumnId, out var col) || col.IsDone != (x.CompletedAt != null) || x.Priority is not ("none" or "low" or "medium" or "high" or "urgent") || x.Checklist.Count > 100 || x.Links.Count > 20 || (x.RelatedDashboardItemId != null && !items.Contains(x.RelatedDashboardItemId.Value)) || (x.LastActiveColumnId != null && !columns.ContainsKey(x.LastActiveColumnId.Value))) throw new DomainError(422, "Niepoprawne zadanie lub powiązania.");
            foreach (var c in x.Checklist) { Validation.Text(c.Title, 200, "Checklista"); if (c.TaskId != x.Id) throw new DomainError(422, "Niepoprawne powiązanie checklisty."); }
            foreach (var l in x.Links) { Validation.Text(l.Title, 120, "Link"); Validation.Url(l.Url); if (l.TaskId != x.Id) throw new DomainError(422, "Niepoprawne powiązanie linku."); }
        }
        if (d.Icons.Sum(x => (long)x.SizeBytes) > 50 * 1024 * 1024) throw new DomainError(422, "Limit ikon.");
        foreach (var x in d.Icons) if (x.Data == null || x.Data.Length > 262144 || x.Data.Length != x.SizeBytes || IconEndpoints.Detect(x.Data) != x.ContentType || x.Sha256 != Convert.ToHexStringLower(SHA256.HashData(x.Data))) throw new DomainError(422, "Niepoprawna ikona.");
        SettingsService.Validate(d.Settings);
    }
}
