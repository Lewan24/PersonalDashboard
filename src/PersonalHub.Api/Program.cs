using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.ResponseCompression;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Tasks;
using PersonalHub.Api.Features.Settings;
using PersonalHub.Api.Features.Backup;
using PersonalHub.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.HttpOverrides;
using System.Net;

if (args.Contains("--healthcheck"))
{
    try { using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) }; return (await client.GetAsync("http://127.0.0.1:8080/health/ready")).IsSuccessStatusCode ? 0 : 1; }
    catch { return 1; }
}
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 25 * 1024 * 1024);
builder.Services.AddProblemDetails(); builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System); builder.Services.AddSingleton<PreviewStore>();
builder.Services.AddSingleton<WriteGate>();
builder.Services.AddOutputCache(options =>
{
    options.SizeLimit = 32 * 1024 * 1024;
    options.MaximumBodySize = 4 * 1024 * 1024;
    options.AddPolicy("hub-data", policy => policy.Expire(TimeSpan.FromSeconds(30)).VaryByValue(context =>
    {
        var revision = context.RequestServices.GetRequiredService<WriteGate>().Revision;
        var utcMinute = context.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow().ToUnixTimeSeconds() / 60;
        // Keep an in-flight read from repopulating the active key after a write or midnight.
        return new KeyValuePair<string, string>("hub", FormattableString.Invariant($"{revision}:{utcMinute}"));
    }));
});
builder.Services.AddDbContext<HubDb>(o => o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=data/dashboard.db;Foreign Keys=True;Default Timeout=5").AddInterceptors(new SqlitePragmas()));
builder.Services.AddScoped<SettingsService>(); builder.Services.AddScoped<TaskService>(); builder.Services.AddScoped<BackupService>(); builder.Services.AddScoped<TransferService>();
builder.Services.AddResponseCompression(o => { o.EnableForHttps = true; o.Providers.Add<BrotliCompressionProvider>(); o.Providers.Add<GzipCompressionProvider>(); });
var trustedProxies = (builder.Configuration["TrustedProxies"] ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries).Select(IPAddress.Parse).ToArray();
if (trustedProxies.Length > 0) builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    o.ForwardLimit = 1; o.KnownProxies.Clear(); o.KnownIPNetworks.Clear();
    foreach (var proxy in trustedProxies) o.KnownProxies.Add(proxy);
});
var app = builder.Build();
TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HubDb>();
    var path = Path.GetFullPath(db.Database.GetDbConnection().DataSource); Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    if (File.Exists(path))
    {
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray(); var known = db.Database.GetMigrations().ToArray();
        if (applied.Except(known).Any()) throw new InvalidOperationException("Baza jest nowsza niż aplikacja. Przywróć zgodną wersję obrazu.");
        if ((await db.Database.GetPendingMigrationsAsync()).Any() && new FileInfo(path).Length > 0) await scope.ServiceProvider.GetRequiredService<BackupService>().Create("pre-migration-1");
    }
    await db.Database.MigrateAsync(); await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
    await Seed.Run(db, scope.ServiceProvider.GetRequiredService<TimeProvider>());
}
app.UseExceptionHandler();
app.UseStatusCodePages(async context => await Results.Problem(statusCode: context.HttpContext.Response.StatusCode).ExecuteAsync(context.HttpContext));
app.Use(async (context, next) =>
{
    try
    {
        var limit = context.Request.Path == SqliteSnapshot.RestorePath ? SqliteSnapshot.MaxUploadBytes
            : context.Request.Path == "/api/v1/import/preview" ? 25 * 1024 * 1024
            : context.Request.Path == "/api/v1/icons" ? 300 * 1024 : 1024 * 1024;
        var feature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = limit;
        if (context.Request.ContentLength > limit) throw new DomainError(413, "Przekroczono limit żądania.");
        await next();
    }
    catch (Exception error) when (error is DomainError or System.Text.Json.JsonException or BadHttpRequestException or DbUpdateConcurrencyException or DbUpdateException or ArgumentException or InvalidOperationException or NullReferenceException or KeyNotFoundException or System.Reflection.TargetInvocationException)
    {
        if (context.Response.HasStarted) throw;
        var status = error is DomainError domain ? domain.Status : error is BadHttpRequestException bad ? bad.StatusCode : error is DbUpdateConcurrencyException ? 409 : error is DbUpdateException ? 422 : 400;
        var title = error is DomainError ? error.Message : status == 409 ? "Konflikt zapisu. Odśwież dane." : "Niepoprawne dane żądania.";
        await Results.Problem(statusCode: status, title: title, extensions: new Dictionary<string, object?> { ["errors"] = new[] { title }, ["current"] = (error as DomainError)?.Current }).ExecuteAsync(context);
    }
});
if (trustedProxies.Length > 0) app.UseForwardedHeaders();
app.UseMiddleware<SecurityMiddleware>(); app.UseMiddleware<WriteGateMiddleware>(); app.UseResponseCompression(); app.UseOutputCache(); app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = c.File.Name == "index.html" ? "no-cache" : c.Context.Request.Path.StartsWithSegments("/assets") ? "public,max-age=31536000,immutable" : "no-cache" });
app.MapOpenApi();
app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/health/ready", async (HubDb db) => await db.Database.CanConnectAsync() && !(await db.Database.GetPendingMigrationsAsync()).Any() ? Results.Ok(new { status = "ready" }) : Results.Problem(statusCode: 503));
var api = app.MapGroup("/api/v1"); api.MapDashboard(); api.MapTasks(); api.MapIcons(); api.MapSettings();
api.MapGet("/bootstrap", async (HubDb db, SettingsService settings, TaskService tasks) => new
{
    tabs = await db.Tabs.OrderBy(x => x.SortOrder).ToListAsync(), sections = await db.Sections.OrderBy(x => x.SortOrder).ToListAsync(),
    items = await db.Items.Include(x => x.Tags).OrderBy(x => x.SortOrder).ToListAsync(), tags = await db.Tags.ToListAsync(),
    columns = await db.Columns.OrderBy(x => x.SortOrder).ToListAsync(), settings = await settings.Read(), taskSummary = await tasks.Summary(), today = await settings.Today(), todayTasks = await tasks.Projection("today")
}).CacheOutput("hub-data");
app.MapFallback(async context =>
{
    if (new[] { "/api", "/health", "/openapi" }.Any(p => context.Request.Path.StartsWithSegments(p))) await Results.Problem(statusCode: 404, title: "Nieznany endpoint.").ExecuteAsync(context);
    else
    {
        var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
        if (File.Exists(index)) { context.Response.ContentType = "text/html"; context.Response.Headers.CacheControl = "no-cache"; await context.Response.SendFileAsync(index); }
        else await Results.Problem(statusCode: 503, title: "Najpierw zbuduj frontend: npm run build.").ExecuteAsync(context);
    }
});
await app.RunAsync(); return 0;
public partial class Program { }
