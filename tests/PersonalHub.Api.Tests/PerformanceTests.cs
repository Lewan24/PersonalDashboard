using System.Diagnostics;
using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Tasks;
using PersonalHub.Api.Infrastructure.Persistence;
using Xunit;
using Xunit.Abstractions;
namespace PersonalHub.Api.Tests;

public class PerformanceTests(ITestOutputHelper output)
{
    [Fact]
    public async Task BootstrapBudgetWith500CardsAnd1000Tasks()
    {
        using var factory = new HubFactory();
        using var client = factory.Client();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HubDb>();
            var sections = db.Sections.OrderBy(x => x.Id).ToArray();
            var column = db.Columns.First(x => !x.IsDone);
            for (var i = 0; i < 497; i++) db.Items.Add(new DashboardItem { SectionId = sections[i % 3].Id, Title = "Link " + i, Url = "https://example.com/" + i, SortOrder = i / 3 + 1 });
            for (var i = 0; i < 1000; i++) db.Tasks.Add(new HubTask { ColumnId = column.Id, Title = "Zadanie " + i, SortOrder = i });
            await db.SaveChangesAsync();
        }
        await client.GetAsync("/api/v1/bootstrap");
        var measurements = new List<double>();
        for (var i = 0; i < 7; i++)
        {
            var watch = Stopwatch.StartNew();
            var response = await client.GetAsync("/api/v1/bootstrap");
            await response.Content.ReadAsByteArrayAsync();
            watch.Stop(); Assert.True(response.IsSuccessStatusCode); measurements.Add(watch.Elapsed.TotalMilliseconds);
        }
        var median = measurements.Order().ElementAt(3);
        var report = new { cards = 500, tasks = 1000, samplesMs = measurements, medianMs = median, budgetMs = 150, transport = "WebApplicationFactory in-process, warm queries, SQLite temp file", measuredAt = DateTimeOffset.UtcNow };
        output.WriteLine(JsonSerializer.Serialize(report));
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "AGENT_PROMPT.md"))) root = root.Parent;
        if (root != null) await File.WriteAllTextAsync(Path.Combine(root.FullName, "docs", "performance.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Assert.True(median < 150, $"Bootstrap median {median:F2} ms exceeds 150 ms.");
    }
}
