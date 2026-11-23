using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Infrastructure.Persistence;

namespace PersonalHub.Api.Features.Backup;

public sealed record HomepageDocument(List<HomepageTab> Tabs);
public sealed record HomepageTab(string Name, List<HomepageSection> Sections);
public sealed record HomepageSection(string Name, string LayoutMode, int DesktopColumns, bool Collapsed, List<HomepageLink> Links);
public sealed record HomepageLink(string Title, string Url, string Description, bool Service, bool Favorite, bool OpenInNewTab);

public static class HomepageImport
{
    public static async Task<IResult> Import(HomepageDocument document, HubDb db, CancellationToken cancellationToken)
    {
        Validate(document);

        var tabs = await db.Tabs.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var sections = await db.Sections.OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync(cancellationToken);
        var requestedNames = document.Tabs.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var matchingTabs = tabs.Where(x => requestedNames.Contains(x.Name)).Select(x => x.Id).ToHashSet();
        var existingSectionIds = sections.Where(x => matchingTabs.Contains(x.TabId)).Select(x => x.Id).ToArray();
        var items = (await db.Items.Where(x => existingSectionIds.Contains(x.SectionId))
            .Select(x => new { x.SectionId, x.Title, x.Url, x.SortOrder }).ToListAsync(cancellationToken))
            .ToLookup(x => x.SectionId);

        var addedTabs = 0;
        var addedSections = 0;
        var addedItems = 0;
        var duplicates = 0;
        foreach (var importedTab in document.Tabs)
        {
            var tab = tabs.Find(x => SameName(x.Name, importedTab.Name));
            if (tab is null)
            {
                if (tabs.Count >= 50) throw new DomainError(422, "Import przekracza limit 50 zakładek.");
                tab = new DashboardTab { Name = importedTab.Name, SortOrder = Next(tabs.Select(x => x.SortOrder)) };
                tabs.Add(tab);
                db.Tabs.Add(tab);
                addedTabs++;
            }

            var tabSections = sections.Where(x => x.TabId == tab.Id).ToList();
            foreach (var importedSection in importedTab.Sections)
            {
                var section = tabSections.Find(x => SameName(x.Name, importedSection.Name));
                if (section is null)
                {
                    if (tabSections.Count >= 100) throw new DomainError(422, "Import przekracza limit 100 sekcji w zakładce.");
                    section = new DashboardSection
                    {
                        Name = importedSection.Name, TabId = tab.Id,
                        SortOrder = Next(tabSections.Select(x => x.SortOrder)),
                        LayoutMode = importedSection.LayoutMode, DesktopColumns = importedSection.DesktopColumns,
                        IsCollapsed = importedSection.Collapsed,
                    };
                    tabSections.Add(section);
                    db.Sections.Add(section);
                    addedSections++;
                }

                var sectionItems = items[section.Id];
                var keys = sectionItems.Select(x => (x.Title, x.Url)).ToHashSet();
                var count = sectionItems.Count();
                var position = Next(sectionItems.Select(x => x.SortOrder));
                foreach (var link in importedSection.Links)
                {
                    if (!keys.Add((link.Title, link.Url))) { duplicates++; continue; }
                    if (count >= 200) throw new DomainError(422, "Import przekracza limit 200 kart w sekcji.");
                    db.Items.Add(new DashboardItem
                    {
                        SectionId = section.Id, SortOrder = position++,
                        Title = link.Title, Url = link.Url, Description = link.Description,
                        ItemType = link.Service ? "service-card" : link.Description.Length > 0 ? "detailed-link" : "compact-link",
                        IsFavorite = link.Favorite, OpenInNewTab = link.OpenInNewTab,
                    });
                    count++;
                    addedItems++;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { tabs = addedTabs, sections = addedSections, items = addedItems, duplicates });
    }

    private static void Validate(HomepageDocument document)
    {
        if (document.Tabs is not { Count: > 0 and <= 50 })
            throw new DomainError(422, "Import musi zawierać od 1 do 50 zakładek.");
        var tabs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var tab in document.Tabs)
        {
            Validation.Text(tab?.Name, 80, "Zakładka Homepage");
            if (tab!.Sections is not { Count: > 0 and <= 100 } || !tabs.Add(tab.Name))
                throw new DomainError(422, "Powtórzona zakładka lub nieprawidłowa liczba sekcji.");
            var sections = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var section in tab.Sections)
            {
                Validation.Text(section?.Name, 80, "Sekcja Homepage");
                if (section!.Links is not { Count: > 0 and <= 200 } || !sections.Add(section.Name) ||
                    section.LayoutMode is not ("grid" or "list") || section.DesktopColumns is < 1 or > 6)
                    throw new DomainError(422, "Powtórzona sekcja, nieprawidłowy układ lub liczba linków.");
                foreach (var link in section.Links)
                {
                    Validation.Text(link?.Title, 120, "Nazwa linku Homepage");
                    Validation.Text(link!.Description, 500, "Opis linku Homepage", false);
                    Validation.Url(link.Url);
                }
            }
        }
    }

    private static bool SameName(string left, string right) => string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
    private static int Next(IEnumerable<int> positions) => positions.DefaultIfEmpty(-1).Max() + 1;
}
