using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Backup;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Settings;
public static class SettingsEndpoints
{
    public static void MapSettings(this RouteGroupBuilder api)
    {
        api.MapGet("/settings", (SettingsService settings) => settings.Read());
        api.MapPut("/settings", async (Dictionary<string, JsonElement> body, SettingsService settings) => { await settings.Write(body); return await settings.Read(); });
        api.MapGet("/system/status", async (HubDb db) => new { appVersion = "1.0.0", schemaVersion = (await db.Database.GetAppliedMigrationsAsync()).LastOrDefault(), databaseBytes = File.Exists(db.Database.GetDbConnection().DataSource) ? new FileInfo(db.Database.GetDbConnection().DataSource).Length : 0, authentication = false });
        api.MapPost("/system/test-write", async (HubDb db, TimeProvider clock) => { var row = await db.Metadata.FindAsync("WriteTest"); if (row == null) db.Metadata.Add(row = new SchemaMetadata { Key = "WriteTest" }); row.Value = clock.GetUtcNow().ToString("O"); await db.SaveChangesAsync(); return new { success = true }; });
        api.MapPost("/system/seed", async (HubDb db, TimeProvider clock) => { await Seed.Run(db, clock, true); return Results.Ok(new { success = true }); });
        api.MapGet("/export/json", async (bool? includeIcons, TransferService transfer) => Results.File(JsonSerializer.SerializeToUtf8Bytes(await transfer.Export(includeIcons != false), new JsonSerializerOptions(JsonSerializerDefaults.Web)), "application/json", "personal-hub.json"));
        api.MapPost("/import/preview", (ExportDocument document, TransferService transfer) => transfer.Preview(document));
        api.MapPost("/import/commit", async (JsonElement body, TransferService transfer) => { if (!body.TryGetProperty("confirmed", out var c) || !c.GetBoolean()) throw new DomainError(422, "Potwierdź zastąpienie danych."); await transfer.Commit(body.GetProperty("previewToken").GetString()!); return Results.Ok(new { success = true }); });
        api.MapGet("/backup/sqlite", async (BackupService backup) => { var path = await backup.Create(); return Results.File(path, "application/vnd.sqlite3", "personal-hub.db"); });
        api.MapPost("/backup/create", async (BackupService backup) => new { fileName = Path.GetFileName(await backup.Create()) });
        api.MapGet("/backup/list", (BackupService backup) => Directory.Exists(backup.DirectoryPath) ? new DirectoryInfo(backup.DirectoryPath).GetFiles("*.db").OrderByDescending(x => x.Name).Select(x => new { fileName = x.Name, sizeBytes = x.Length }) : []);
        api.MapGet("/backup/download/{fileName}", (string fileName, BackupService backup) =>
        {
            if (Path.GetFileName(fileName) != fileName || !fileName.EndsWith(".db")) throw new DomainError(404, "Nieznana kopia.");
            var path = Path.Combine(backup.DirectoryPath, fileName); return File.Exists(path) ? Results.File(path, "application/vnd.sqlite3", fileName) : Results.NotFound();
        });
    }
}
