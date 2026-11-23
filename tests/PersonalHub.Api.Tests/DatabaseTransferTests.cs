using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PersonalHub.Api.Features.Backup;
using PersonalHub.Api.Infrastructure.Persistence;
using Xunit;

namespace PersonalHub.Api.Tests;

public class DatabaseTransferTests
{
    [Fact]
    public async Task ClearRequiresConfirmationAndKeepsADownloadableBackup()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var before = await Bootstrap(client);
        var tag = await Read(await client.PostAsJsonAsync("/api/v1/tags", new { name = "Przed czyszczeniem" }));
        await Read(await client.PutAsJsonAsync("/api/v1/settings", new { theme = "light" }));

        using var denied = await client.PostAsJsonAsync("/api/v1/system/clear", new { confirmed = false });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, denied.StatusCode);
        var beforeClear = await client.GetFromJsonAsync<JsonArray>("/api/v1/backup/list");
        Assert.Empty(beforeClear!);

        var cleared = await Read(await client.PostAsJsonAsync("/api/v1/system/clear", new { confirmed = true }));
        var backup = await DownloadBackup(client, cleared, "pre-clear-");
        var after = await Bootstrap(client);
        foreach (var collection in new[] { "tabs", "sections", "items", "tags" })
            Assert.Empty(after[collection]!.AsArray());
        Assert.Equal("dark", after["settings"]!["theme"]!.GetValue<string>());
        Assert.Equal(before["columns"]!.AsArray().Count, after["columns"]!.AsArray().Count);

        using var response = await Restore(client, backup);
        response.EnsureSuccessStatusCode();
        var restored = await Bootstrap(client);
        Assert.Equal(before["tabs"]!.AsArray().Select(Id), restored["tabs"]!.AsArray().Select(Id));
        Assert.Equal(Id(tag), Id(Assert.Single(restored["tags"]!.AsArray())));
        Assert.Equal("light", restored["settings"]!["theme"]!.GetValue<string>());
    }

    [Fact]
    public async Task ClearLeavesDataInPlaceIfTheBackupCannotBeWritten()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var before = await Bootstrap(client);
        await File.WriteAllTextAsync(Path.Combine(app.Folder, "backups"), "Blocks the backup directory");

        using var response = await client.PostAsJsonAsync("/api/v1/system/clear", new { confirmed = true });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.True(JsonNode.DeepEquals(before, await Bootstrap(client)));
    }

    [Fact]
    public async Task RestoreTransfersItemsTasksIconsAndSettingsBetweenInstances()
    {
        using var source = new HubFactory();
        using var destination = new HubFactory();
        using var dev = source.Client();
        using var prod = destination.Client();

        var sourceData = await Bootstrap(dev);
        var itemId = Id(sourceData["items"]![0]);
        var columnId = Id(sourceData["columns"]![0]);
        var tag = await Read(await dev.PostAsJsonAsync("/api/v1/tags", new { name = "Dev", color = "#2468ab" }));
        var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8R8AAAAASUVORK5CYII=");
        using var form = new MultipartFormDataContent();
        form.Add(new ByteArrayContent(png), "file", "dev.png");
        var icon = await Read(await dev.PostAsync("/api/v1/icons", form));
        await Read(await dev.PatchAsJsonAsync("/api/v1/items/" + itemId,
            new { title = "Link z dev", iconKey = "icon:" + Id(icon), tagIds = new[] { Id(tag) } }));
        var task = await Read(await dev.PostAsJsonAsync("/api/v1/tasks", new
        {
            title = "Zadanie z dev", columnId, relatedDashboardItemId = itemId, tagIds = new[] { Id(tag) },
            checklist = new[] { new { title = "Sprawdź", isChecked = true } },
            links = new[] { new { title = "Opis", url = "https://example.org/docs" } },
        }));
        await Read(await dev.PutAsJsonAsync("/api/v1/settings", new { theme = "light" }));
        var prodTab = await Read(await prod.PostAsJsonAsync("/api/v1/tabs", new { name = "Poprzednia zakładka" }));
        var exported = await dev.GetByteArrayAsync("/api/v1/backup/sqlite");

        using var unconfirmed = await Restore(prod, exported, confirmed: false);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, unconfirmed.StatusCode);
        using var invalid = await Restore(prod, "not a SQLite snapshot"u8.ToArray());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
        Assert.Contains((await Bootstrap(prod))["tabs"]!.AsArray(), tab => Id(tab) == Id(prodTab));

        var result = await Read(await Restore(prod, exported));
        var priorDatabase = await DownloadBackup(prod, result, "pre-restore-");
        var imported = await Bootstrap(prod);
        Assert.DoesNotContain(imported["tabs"]!.AsArray(), tab => Id(tab) == Id(prodTab));
        Assert.Equal("light", imported["settings"]!["theme"]!.GetValue<string>());
        Assert.Equal("Link z dev", imported["items"]!.AsArray().Single(x => Id(x) == itemId)!["title"]!.GetValue<string>());
        Assert.Equal(png, await prod.GetByteArrayAsync("/api/v1/icons/" + Id(icon)));

        var importedTask = await Read(await prod.GetAsync("/api/v1/tasks/" + Id(task)));
        Assert.True(JsonNode.DeepEquals(task, importedTask));

        using var restoreOld = await Restore(prod, priorDatabase);
        restoreOld.EnsureSuccessStatusCode();
        Assert.Contains((await Bootstrap(prod))["tabs"]!.AsArray(), tab => Id(tab) == Id(prodTab));
    }

    [Fact]
    public async Task RestoreRejectsAnUnrelatedSqliteDatabase()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        var before = await Bootstrap(client);
        var path = Path.Combine(app.Folder, "unrelated.db");
        await using (var connection = new SqliteConnection($"Data Source={path};Pooling=False"))
        {
            await connection.OpenAsync();
            using var command = connection.CreateCommand();
            command.CommandText = "CREATE TABLE Unrelated (Id INTEGER PRIMARY KEY)";
            await command.ExecuteNonQueryAsync();
        }

        using var response = await Restore(client, await File.ReadAllBytesAsync(path));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.True(JsonNode.DeepEquals(before, await Bootstrap(client)));
    }

    [Fact]
    public async Task RestoreUpgradesAKnownOlderSnapshot()
    {
        using var app = new HubFactory();
        using var client = app.Client();
        await Bootstrap(client);
        var path = Path.Combine(app.Folder, "old.db");
        var options = new DbContextOptionsBuilder<HubDb>()
            .UseSqlite(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString())
            .Options;
        await using (var previous = new HubDb(options, app.Clock))
        {
            await previous.GetService<IMigrator>().MigrateAsync("20261123100000_ItemShowUrl");
            await Seed.Run(previous, app.Clock);
            await previous.Items.ExecuteUpdateAsync(items => items.SetProperty(item => item.IconKey, "lucide:link"));
        }

        using var response = await Restore(client, await File.ReadAllBytesAsync(path));
        response.EnsureSuccessStatusCode();
        var restored = await Bootstrap(client);
        Assert.All(restored["items"]!.AsArray(), item => Assert.Equal("auto:favicon", item!["iconKey"]!.GetValue<string>()));
    }

    private static string Id(JsonNode? node) => node!["id"]!.GetValue<string>();
    private static async Task<JsonObject> Bootstrap(HttpClient client) => await Read(await client.GetAsync("/api/v1/bootstrap"));

    private static async Task<JsonObject> Read(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonNode.Parse(text)!.AsObject();
    }

    private static async Task<HttpResponseMessage> Restore(HttpClient client, byte[] bytes, bool confirmed = true)
    {
        using var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(SqliteSnapshot.ContentType);
        return await client.PostAsync("/api/v1/backup/restore?confirmed=" + (confirmed ? "true" : "false"), file);
    }

    private static async Task<byte[]> DownloadBackup(HttpClient client, JsonObject result, string prefix)
    {
        var fileName = result["fileName"]!.GetValue<string>();
        Assert.StartsWith(prefix, fileName);
        var backups = await client.GetFromJsonAsync<JsonArray>("/api/v1/backup/list");
        Assert.Contains(backups!, item => item!["fileName"]!.GetValue<string>() == fileName);
        return await client.GetByteArrayAsync("/api/v1/backup/download/" + fileName);
    }
}
