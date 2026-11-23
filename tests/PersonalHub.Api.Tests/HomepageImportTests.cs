using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using PersonalHub.Api.Features.Backup;
using Xunit;

namespace PersonalHub.Api.Tests;

public class HomepageImportTests
{
    [Fact]
    public async Task ImportAppendsToExistingDataAndCanBeRetried()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var before = (await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap"))!;
        var tab = before["tabs"]![0]!;
        var column = before["columns"]![0]!["id"]!.GetValue<Guid>();
        using var createTask = await client.PostAsJsonAsync("/api/v1/tasks", new { columnId = column, title = "Zachowaj zadanie" });
        createTask.EnsureSuccessStatusCode();

        var document = new HomepageDocument([
            new HomepageTab(tab["name"]!.GetValue<string>(), [
                new HomepageSection("Importowana sekcja", "grid", 5, false, [
                    new HomepageLink("Dokumentacja", "https://example.org/docs", "Opis z Homepage", false, true, false),
                    new HomepageLink("Serwer", "https://example.org/service", "", true, false, true)
                ])
            ])
        ]);

        using var import = await client.PostAsJsonAsync("/api/v1/import/homepage", document);
        import.EnsureSuccessStatusCode();
        var added = (await import.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal(0, added["tabs"]!.GetValue<int>());
        Assert.Equal(1, added["sections"]!.GetValue<int>());
        Assert.Equal(2, added["items"]!.GetValue<int>());

        using var retry = await client.PostAsJsonAsync("/api/v1/import/homepage", document);
        retry.EnsureSuccessStatusCode();
        var repeat = (await retry.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.Equal(0, repeat["items"]!.GetValue<int>());
        Assert.Equal(2, repeat["duplicates"]!.GetValue<int>());

        var after = (await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap"))!;
        var section = Assert.Single(after["sections"]!.AsArray(), x => x!["name"]!.GetValue<string>() == "Importowana sekcja")!;
        Assert.Equal(tab["id"]!.GetValue<Guid>(), section["tabId"]!.GetValue<Guid>());
        Assert.Equal(5, section["desktopColumns"]!.GetValue<int>());
        var items = after["items"]!.AsArray().Where(x => x!["sectionId"]!.GetValue<Guid>() == section["id"]!.GetValue<Guid>()).ToArray();
        Assert.Equal(new[] { "Dokumentacja", "Serwer" }, items.Select(x => x!["title"]!.GetValue<string>()));
        Assert.Equal("Opis z Homepage", items[0]!["description"]!.GetValue<string>());
        Assert.True(items[0]!["isFavorite"]!.GetValue<bool>());
        Assert.False(items[0]!["openInNewTab"]!.GetValue<bool>());
        Assert.Equal("auto:favicon", items[0]!["iconKey"]!.GetValue<string>());
        Assert.Equal("service-card", items[1]!["itemType"]!.GetValue<string>());
        var tasks = (await client.GetFromJsonAsync<JsonObject>("/api/v1/tasks"))!;
        Assert.Single(tasks["tasks"]!.AsArray());
    }

    [Fact]
    public async Task InvalidBatchDoesNotAddAnyTabs()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var document = new HomepageDocument([
            new HomepageTab("Nowa zakładka", [
                new HomepageSection("Linki", "list", 1, false, [
                    new HomepageLink("Poprawny", "https://example.org", "", false, false, true),
                    new HomepageLink("Niepoprawny", "file:///home", "", false, false, true)
                ])
            ])
        ]);

        using var response = await client.PostAsJsonAsync("/api/v1/import/homepage", document);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var after = (await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap"))!;
        Assert.DoesNotContain(after["tabs"]!.AsArray(), x => x!["name"]!.GetValue<string>() == "Nowa zakładka");
    }

    [Fact]
    public async Task CachedReadsVaryByQueryAndRefreshAfterWrites()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var bootstrap = (await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap"))!;
        using var cached = await client.GetAsync("/api/v1/bootstrap");
        Assert.NotNull(cached.Headers.Age);
        using var empty = await client.GetAsync("/api/v1/tasks?q=brak");
        empty.EnsureSuccessStatusCode();

        using var added = await client.PostAsJsonAsync("/api/v1/tasks", new
        {
            columnId = bootstrap["columns"]![0]!["id"]!.GetValue<Guid>(),
            title = "Zadanie po zapisie",
            dueDate = bootstrap["today"]!.GetValue<string>(),
        });
        added.EnsureSuccessStatusCode();

        var updated = (await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap"))!;
        Assert.Single(updated["todayTasks"]!.AsArray());
        var matching = (await client.GetFromJsonAsync<JsonObject>("/api/v1/tasks?q=Zadanie"))!;
        Assert.Single(matching["tasks"]!.AsArray());
        var other = (await client.GetFromJsonAsync<JsonObject>("/api/v1/tasks?q=brak"))!;
        Assert.Empty(other["tasks"]!.AsArray());
    }
}
