using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using PersonalHub.Api.Infrastructure.Persistence;
using PersonalHub.Api.Features.Tasks;
using Xunit;

namespace PersonalHub.Api.Tests;
public class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-03-28T23:30:00Z");
    public override DateTimeOffset GetUtcNow() => Now;
}
public class HubFactory : WebApplicationFactory<Program>
{
    public string Folder { get; } = Path.Combine(Path.GetTempPath(), "hub-tests-" + Guid.NewGuid());
    public TestClock Clock { get; } = new();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(Folder);
        builder.UseEnvironment("Testing").ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string,string?> { ["ConnectionStrings:Default"] = $"Data Source={Folder}/dashboard.db;Foreign Keys=True;Default Timeout=5" }));
        builder.ConfigureServices(services => services.AddSingleton<TimeProvider>(Clock));
    }
    public HttpClient Client() { var client=CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new Uri("http://localhost") }); client.DefaultRequestHeaders.Add("X-PersonalHub-Client","1"); return client; }
}
public class ApiTests
{
    private static async Task<JsonObject> Read(HttpResponseMessage response) { var text=await response.Content.ReadAsStringAsync(); Assert.True(response.IsSuccessStatusCode,text); return JsonNode.Parse(text)!.AsObject(); }
    private static async Task<JsonObject> Bootstrap(HttpClient client) => await Read(await client.GetAsync("/api/v1/bootstrap"));
    private static string Id(JsonNode node) => node["id"]!.GetValue<string>();
    private static object Version(JsonObject task) => new {expectedVersion=task["version"]!.GetValue<int>()};
    private static async Task<JsonObject> NewTask(HttpClient client, JsonObject b, string? due="2026-03-29") => await Read(await client.PostAsJsonAsync("/api/v1/tasks",new {title="Test zadania",columnId=Id(b["columns"]![2]!),dueDate=due,descriptionMarkdown="Opis **test**",checklist=new[]{new{title="Sprawdzić",isChecked=false}},links=new[]{new{title="Dokumentacja",url="https://example.com"}}}));

    [Fact] public async Task SeedIsPersistentAndNotRepeated()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);Assert.Equal(3,b["tabs"]!.AsArray().Count);
        using(var scope=f.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<HubDb>();await db.Items.ExecuteDeleteAsync();await db.Sections.ExecuteDeleteAsync();await db.Tabs.ExecuteDeleteAsync();await Seed.Run(db,f.Clock);Assert.Empty(await db.Tabs.ToListAsync());}
        Assert.Equal("2026-03-29",b["today"]!.GetValue<string>());
    }
    [Fact] public async Task DashboardMoveAndVersionConflict()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);var item=b["items"]![0]!;var section=b["sections"]!.AsArray().First(x=>Id(x!)!=item["sectionId"]!.GetValue<string>())!;
        Assert.True((await c.PostAsJsonAsync("/api/v1/items/move",new {itemId=Id(item),targetSectionId=Id(section),targetIndex=0,expectedVersion=item["version"]!.GetValue<int>()})).IsSuccessStatusCode);
        var refreshed=await Bootstrap(c);Assert.Equal(Id(section),refreshed["items"]!.AsArray().Single(x=>Id(x!)==Id(item))!["sectionId"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Conflict,(await c.PatchAsJsonAsync("/api/v1/items/"+Id(item),new {title="Stara wersja",expectedVersion=1})).StatusCode);
    }
    [Fact] public async Task TodayStatusCompleteReopenAndOneRecord()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);var task=await NewTask(c,b);var id=Id(task);var original=task["columnId"]!.GetValue<string>();
        var today=await Read(await c.GetAsync("/api/v1/tasks/today"));Assert.Single(today["tasks"]!.AsArray());Assert.Equal(original,today["tasks"]![0]!["columnId"]!.GetValue<string>());
        task=await Read(await c.PostAsJsonAsync($"/api/v1/tasks/{id}/complete",Version(task)));Assert.NotNull(task["completedAt"]);Assert.Empty((await Read(await c.GetAsync("/api/v1/tasks/today")))["tasks"]!.AsArray());
        task=await Read(await c.PostAsJsonAsync($"/api/v1/tasks/{id}/reopen",Version(task)));Assert.Equal(original,task["columnId"]!.GetValue<string>());Assert.Null(task["completedAt"]);
        using var scope=f.Services.CreateScope();Assert.Equal(1,await scope.ServiceProvider.GetRequiredService<HubDb>().Tasks.CountAsync());
    }
    [Fact] public async Task MoveTodayOnlyChangesDueDateAndStatusOnlyChangesColumn()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);var task=await NewTask(c,b,"2026-03-28");var id=Id(task);var column=task["columnId"]!.GetValue<string>();
        Assert.Single((await Read(await c.GetAsync("/api/v1/tasks/overdue")))["tasks"]!.AsArray());
        task=(await Read(await c.PostAsJsonAsync($"/api/v1/tasks/{id}/move",new {targetColumnId="today",expectedVersion=1})))["task"]!.AsObject();Assert.Equal(column,task["columnId"]!.GetValue<string>());Assert.Equal("2026-03-29",task["dueDate"]!.GetValue<string>());
        task=(await Read(await c.PostAsJsonAsync($"/api/v1/tasks/{id}/move",new {targetColumnId=Id(b["columns"]![0]!),targetIndex=0,expectedVersion=task["version"]!.GetValue<int>()})))["task"]!.AsObject();Assert.Equal("2026-03-29",task["dueDate"]!.GetValue<string>());
    }
    [Theory]
    [InlineData("2026-03-28T22:59:59Z","2026-03-28")]
    [InlineData("2026-03-28T23:00:00Z","2026-03-29")]
    [InlineData("2026-03-29T01:00:00Z","2026-03-29")]
    [InlineData("2026-10-24T22:00:00Z","2026-10-25")]
    [InlineData("2026-10-25T01:00:00Z","2026-10-25")]
    [InlineData("2026-10-25T23:00:00Z","2026-10-26")]
    public async Task WarsawCalendarBoundaries(string instant,string expected)
    {using var f=new HubFactory();f.Clock.Now=DateTimeOffset.Parse(instant);using var c=f.Client();Assert.Equal(expected,(await Bootstrap(c))["today"]!.GetValue<string>());}
    [Fact] public async Task ArchiveSearchAndChecklistPatchPreserveData()
    {
        using var f=new HubFactory();using var c=f.Client();var task=await NewTask(c,await Bootstrap(c));var id=Id(task);var checklist=task["checklist"]!.DeepClone();checklist[0]!["isChecked"]=true;
        task=await Read(await c.PatchAsJsonAsync("/api/v1/tasks/"+id,new {expectedVersion=1,checklist}));Assert.True(task["checklist"]![0]!["isChecked"]!.GetValue<bool>());Assert.Single(task["links"]!.AsArray());
        task=await Read(await c.PostAsJsonAsync($"/api/v1/tasks/{id}/archive",Version(task)));var result=await Read(await c.GetAsync("/api/v1/tasks?archived=true&q=Test"));Assert.Single(result["tasks"]!.AsArray());Assert.Single(result["tasks"]![0]!["checklist"]!.AsArray());
    }
    [Fact] public async Task ColumnGuardsAndSoftWip()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);var task=await NewTask(c,b);var done=Id(b["columns"]![3]!);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.SendAsync(new HttpRequestMessage(HttpMethod.Delete,"/api/v1/task-columns/"+done){Content=JsonContent.Create(new{})})).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await c.SendAsync(new HttpRequestMessage(HttpMethod.Delete,"/api/v1/task-columns/"+task["columnId"]!.GetValue<string>()){Content=JsonContent.Create(new{})})).StatusCode);
        await Read(await c.PatchAsJsonAsync("/api/v1/task-columns/"+task["columnId"]!.GetValue<string>(),new {wipLimit=1}));await NewTask(c,b);Assert.Equal(2,(await Read(await c.GetAsync("/api/v1/tasks")))["total"]!.GetValue<int>());
    }
    [Fact] public async Task SecurityAndRouting()
    {
        using var f=new HubFactory();using var c=f.Client();
        using var untrusted=f.CreateClient(new WebApplicationFactoryClientOptions{BaseAddress=new Uri("http://localhost")});Assert.Equal(HttpStatusCode.Forbidden,(await untrusted.PostAsJsonAsync("/api/v1/tabs",new{name="x"})).StatusCode);
        c.DefaultRequestHeaders.Add("Origin","https://evil.example");Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync("/api/v1/tabs",new{name="x"})).StatusCode);c.DefaultRequestHeaders.Remove("Origin");
        c.DefaultRequestHeaders.Host="evil.example";Assert.Equal(HttpStatusCode.BadRequest,(await c.GetAsync("/health/live")).StatusCode);c.DefaultRequestHeaders.Host="localhost";
        foreach(var path in new[]{"/api/missing","/health/missing","/openapi/missing"}){var r=await c.GetAsync(path);Assert.Equal(HttpStatusCode.NotFound,r.StatusCode);Assert.Contains("application/problem+json",r.Content.Headers.ContentType!.ToString());}
        Assert.Equal(HttpStatusCode.OK,(await c.GetAsync("/openapi/v1.json")).StatusCode);
    }
    [Theory][InlineData("javascript:alert(1)")][InlineData("data:text/html,x")][InlineData("file:///tmp/x")]
    public async Task DangerousUrlsRejected(string url)
    {using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.PostAsJsonAsync("/api/v1/items",new{sectionId=Id(b["sections"]![0]!),title="x",url})).StatusCode);}
    [Fact] public async Task ImportRoundTripAndInvalidPreview()
    {
        using var f=new HubFactory();using var c=f.Client();await NewTask(c,await Bootstrap(c));var export=await Read(await c.GetAsync("/api/v1/export/json"));var preview=await Read(await c.PostAsJsonAsync("/api/v1/import/preview",export));
        await Read(await c.PostAsJsonAsync("/api/v1/import/commit",new{previewToken=preview["previewToken"]!.GetValue<string>(),confirmed=true}));
        Assert.Single((await Read(await c.GetAsync("/api/v1/tasks")))["tasks"]!.AsArray());
        var restored=await Read(await c.GetAsync("/api/v1/export/json"));
        foreach(var collection in new[]{"tabs","sections","items","columns","tasks"})
            Assert.Equal(export[collection]!.AsArray().Select(x=>Id(x!)+":"+x!["sortOrder"]!.GetValue<int>()).Order().ToArray(),restored[collection]!.AsArray().Select(x=>Id(x!)+":"+x!["sortOrder"]!.GetValue<int>()).Order().ToArray());
        export["items"]![0]!["url"]="javascript:evil";Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.PostAsJsonAsync("/api/v1/import/preview",export)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.PostAsJsonAsync("/api/v1/import/commit",new{previewToken=preview["previewToken"]!.GetValue<string>(),confirmed=true})).StatusCode);
    }
    [Fact] public async Task IconsRoundTripAndMaliciousUploadRejected()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);
        using var bad=new MultipartFormDataContent();bad.Add(new ByteArrayContent("<svg onload='evil'/>"u8.ToArray()),"file","icon.png");Assert.Equal(HttpStatusCode.UnsupportedMediaType,(await c.PostAsync("/api/v1/icons",bad)).StatusCode);
        var png=Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8R8AAAAASUVORK5CYII=");
        using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(png),"file","test.png");var icon=await Read(await c.PostAsync("/api/v1/icons",form));var item=Id(b["items"]![0]!);
        await Read(await c.PatchAsJsonAsync("/api/v1/items/"+item,new{iconKey="icon:"+Id(icon)}));
        var export=await Read(await c.GetAsync("/api/v1/export/json"));var preview=await Read(await c.PostAsJsonAsync("/api/v1/import/preview",export));await Read(await c.PostAsJsonAsync("/api/v1/import/commit",new{previewToken=preview["previewToken"]!.GetValue<string>(),confirmed=true}));
        Assert.Equal(png,await c.GetByteArrayAsync("/api/v1/icons/"+Id(icon)));
        var backup=await c.GetByteArrayAsync("/api/v1/backup/sqlite");var path=Path.Combine(f.Folder,"icons.db");await File.WriteAllBytesAsync(path,backup);using var connection=new Microsoft.Data.Sqlite.SqliteConnection("Data Source="+path);await connection.OpenAsync();using var cmd=connection.CreateCommand();cmd.CommandText="SELECT Data FROM Icons";Assert.Equal(png,(byte[])(await cmd.ExecuteScalarAsync())!);
        Assert.True((await c.SendAsync(new HttpRequestMessage(HttpMethod.Delete,"/api/v1/icons/"+Id(icon)){Content=JsonContent.Create(new{})})).IsSuccessStatusCode);Assert.Equal("lucide:link",(await Bootstrap(c))["items"]!.AsArray().Single(x=>Id(x!)==item)!["iconKey"]!.GetValue<string>());
    }
    [Fact] public async Task SettingsBooleansAndFavoriteProjectionPersist()
    {
        using var f=new HubFactory();using var c=f.Client();var b=await Bootstrap(c);await NewTask(c,b,"2026-03-28");
        await Read(await c.PutAsJsonAsync("/api/v1/settings",new{showOverdueInToday=true,clockSeconds=true}));Assert.Single((await Read(await c.GetAsync("/api/v1/tasks/today")))["tasks"]!.AsArray());
        var item=b["items"]![0]!;await Read(await c.PatchAsJsonAsync("/api/v1/items/"+Id(item),new{isFavorite=true}));var current=await Bootstrap(c);Assert.True(current["items"]!.AsArray().Single(x=>Id(x!)==Id(item))!["isFavorite"]!.GetValue<bool>());
        using var scope=f.Services.CreateScope();Assert.Equal(3,await scope.ServiceProvider.GetRequiredService<HubDb>().Items.CountAsync());
    }
    [Fact] public async Task InvalidPatchDoesNotPersistPartialChangesAndTaskVersionRequired()
    {
        using var f=new HubFactory();using var c=f.Client();var task=await NewTask(c,await Bootstrap(c));var id=Id(task);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.PatchAsJsonAsync("/api/v1/tasks/"+id,new{title="Changed"})).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,(await c.PatchAsJsonAsync("/api/v1/tasks/"+id,new{title="Changed",expectedVersion=1,priority="invalid"})).StatusCode);
        Assert.Equal("Test zadania",(await Read(await c.GetAsync("/api/v1/tasks/"+id)))["title"]!.GetValue<string>());
    }
    [Fact] public async Task ExistingDatabaseRestartsWithoutReseedAndFreshBackupIsRestorable()
    {
        using var f=new HubFactory();using var c=f.Client();await NewTask(c,await Bootstrap(c));
        using var scope=f.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<HubDb>();var snapshot=await scope.ServiceProvider.GetRequiredService<PersonalHub.Api.Features.Backup.BackupService>().Create();
        var options=new DbContextOptionsBuilder<HubDb>().UseSqlite("Data Source="+snapshot+";Foreign Keys=True").Options;using var restored=new HubDb(options,f.Clock);await restored.Database.MigrateAsync();await Seed.Run(restored,f.Clock);Assert.Equal(1,await restored.Tasks.CountAsync());Assert.Equal(3,await restored.Tabs.CountAsync());Assert.Empty(await restored.Database.GetPendingMigrationsAsync());
    }
    [Fact] public async Task BackupContainsCommittedWalAndSettingsPersist()
    {
        using var f=new HubFactory();using var c=f.Client();await NewTask(c,await Bootstrap(c));await Read(await c.PutAsJsonAsync("/api/v1/settings",new{theme="light",timezone="America/New_York",columns=4}));
        var response=await c.GetAsync("/api/v1/backup/sqlite");Assert.True(response.IsSuccessStatusCode);var path=Path.Combine(f.Folder,"restored.db");await File.WriteAllBytesAsync(path,await response.Content.ReadAsByteArrayAsync());
        using var connection=new Microsoft.Data.Sqlite.SqliteConnection("Data Source="+path);await connection.OpenAsync();using var cmd=connection.CreateCommand();cmd.CommandText="PRAGMA integrity_check";Assert.Equal("ok",await cmd.ExecuteScalarAsync());cmd.CommandText="SELECT COUNT(*) FROM Tasks";Assert.Equal(1L,await cmd.ExecuteScalarAsync());
        Assert.Equal("light",(await Read(await c.GetAsync("/api/v1/settings")))["theme"]!.GetValue<string>());
    }
}
