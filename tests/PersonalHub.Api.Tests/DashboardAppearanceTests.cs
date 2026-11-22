using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PersonalHub.Api.Infrastructure.Persistence;
using Xunit;

namespace PersonalHub.Api.Tests;
public class DashboardAppearanceTests
{
    [Fact]
    public async Task SectionWidthIsValidatedPersistedAndExported()
    {
        using var factory = new HubFactory();
        using var client = factory.Client();
        var bootstrap = await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap");
        Assert.Equal("#cc0000", bootstrap!["settings"]!["accent"]!.GetValue<string>());
        var section = bootstrap["sections"]![0]!;
        var id = section["id"]!.GetValue<string>();
        Assert.Equal(100, section["widthPercent"]!.GetValue<int>());
        var response = await client.PatchAsJsonAsync("/api/v1/sections/" + id, new { widthPercent = 50, expectedVersion = section["version"]!.GetValue<int>() });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var updated = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(50, updated!["widthPercent"]!.GetValue<int>());
        var invalid = await client.PatchAsJsonAsync("/api/v1/sections/" + id, new { widthPercent = 37, expectedVersion = updated["version"]!.GetValue<int>() });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
        var export = await client.GetFromJsonAsync<JsonObject>("/api/v1/export/json");
        Assert.Equal(50, export!["sections"]!.AsArray().Single(x => x!["id"]!.GetValue<string>() == id)!["widthPercent"]!.GetValue<int>());
        var preview = await client.PostAsJsonAsync("/api/v1/import/preview", export);
        var token = (await preview.Content.ReadFromJsonAsync<JsonObject>())!["previewToken"]!.GetValue<string>();
        var commit = await client.PostAsJsonAsync("/api/v1/import/commit", new { previewToken = token, confirmed = true });
        Assert.True(commit.IsSuccessStatusCode, await commit.Content.ReadAsStringAsync());
        var restored = await client.GetFromJsonAsync<JsonObject>("/api/v1/bootstrap");
        Assert.Equal(50, restored!["sections"]!.AsArray().Single(x => x!["id"]!.GetValue<string>() == id)!["widthPercent"]!.GetValue<int>());
    }

    [Fact]
    public async Task ExistingSectionsBecomeFullWidthAndCustomAccentIsPreserved()
    {
        var folder = Path.Combine(Path.GetTempPath(), "hub-layout-" + Guid.NewGuid());
        Directory.CreateDirectory(folder);
        var options = new DbContextOptionsBuilder<HubDb>().UseSqlite($"Data Source={folder}/dashboard.db").Options;
        await using var db = new HubDb(options, new TestClock());
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261122222121_InitialSchema");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Tabs (Id,Name,IconKey,AccentColor,SortOrder,IsHidden,CreatedAt,UpdatedAt,Version) VALUES ('01900000-0000-7000-8000-000000000001','Existing','lucide:folder','#a5c8ae',0,0,'2026-01-01','2026-01-01',1);");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Sections (Id,TabId,Name,Description,IconKey,AccentColor,SortOrder,IsCollapsed,LayoutMode,DesktopColumns,TabletColumns,MobileColumns,CreatedAt,UpdatedAt,Version) VALUES ('01900000-0000-7000-8000-000000000002','01900000-0000-7000-8000-000000000001','Existing','','lucide:folder','#123456',0,0,'grid',1,1,1,'2026-01-01','2026-01-01',1);");
        await db.Database.ExecuteSqlRawAsync("INSERT INTO Settings (Key,ValueJson,UpdatedAt) VALUES ('accent','\"#a5c8ae\"','2026-01-01');");
        await migrator.MigrateAsync();
        var section = await db.Sections.SingleAsync();
        Assert.Equal(100, section.WidthPercent);
        Assert.Equal("#123456", section.AccentColor);
        Assert.Equal("#cc0000", (await db.Tabs.SingleAsync()).AccentColor);
        Assert.Equal("\"#cc0000\"", (await db.Settings.SingleAsync()).ValueJson);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }
}
