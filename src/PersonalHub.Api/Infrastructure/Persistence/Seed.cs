using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Tasks;
using PersonalHub.Api.Features.Settings;

namespace PersonalHub.Api.Infrastructure.Persistence;
public static class Seed
{
    public static List<TaskColumn> DefaultColumns() =>
        new[] { "Backlog", "Do zrobienia", "W trakcie", "Zrobione" }
            .Select((name, index) => new TaskColumn { Name = name, SortOrder = index, IsDone = index == 3 })
            .ToList();

    public static async Task Run(HubDb db, TimeProvider clock, bool additive = false)
    {
        if (!additive && await db.Metadata.AnyAsync(x => x.Key == "SeedCompletedAt")) return;
        foreach (var name in new[] { "Praca", "Cybersecurity", "Prywatne" })
        {
            var tab = new DashboardTab { Name = name + " · przykład", SortOrder = await db.Tabs.CountAsync() + db.Tabs.Local.Count };
            var section = new DashboardSection { TabId = tab.Id, Name = "Na co dzień", Description = "Przykładowe linki — dopasuj je do siebie" };
            db.AddRange(tab, section);
            db.Items.Add(new DashboardItem { SectionId = section.Id, Title = name == "Cybersecurity" ? "OWASP" : name == "Prywatne" ? "Wikipedia" : "GitHub", Url = name == "Cybersecurity" ? "https://owasp.org" : name == "Prywatne" ? "https://pl.wikipedia.org" : "https://github.com", Description = "Dane przykładowe", ItemType = "detailed-link", IsFavorite = name == "Praca" });
        }
        if (!await db.Columns.AnyAsync()) db.Columns.AddRange(DefaultColumns());
        if (!additive) db.Metadata.Add(new SchemaMetadata { Key = "SeedCompletedAt", Value = clock.GetUtcNow().ToString("O") });
        await db.SaveChangesAsync();
    }
}
