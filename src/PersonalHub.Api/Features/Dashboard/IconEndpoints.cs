using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Dashboard;

public static class IconEndpoints
{
    public static void MapIcons(this RouteGroupBuilder api)
    {
        api.MapGet("/icons", async (HubDb db) => await db.Icons.Select(x => new { x.Id, x.FileName, x.ContentType, x.SizeBytes, x.Sha256 }).ToListAsync());
        api.MapGet("/icons/{id:guid}", async (Guid id, HubDb db) => { var icon = await db.Icons.FindAsync(id) ?? throw new DomainError(404, "Nieznana ikona."); return Results.Bytes(icon.Data, icon.ContentType); });
        api.MapPost("/icons", async (HttpRequest request, HubDb db) =>
        {
            var form = await request.ReadFormAsync(); var file = form.Files.GetFile("file") ?? throw new DomainError(422, "Wybierz plik ikony.");
            if (file.Length is < 1 or > 262144) throw new DomainError(413, "Ikona: maksymalnie 256 KB.");
            if (await db.Icons.SumAsync(x => (long)x.SizeBytes) + file.Length > 50 * 1024 * 1024) throw new DomainError(413, "Limit ikon: 50 MB.");
            using var stream = new MemoryStream(); await file.CopyToAsync(stream); var bytes = stream.ToArray();
            var type = Detect(bytes) ?? throw new DomainError(415, "Dozwolone PNG, JPEG, GIF, WebP, ICO. SVG jest zabronione.");
            var icon = new IconAsset { FileName = Path.GetFileName(file.FileName), ContentType = type, Data = bytes, SizeBytes = bytes.Length, Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes)) };
            Validation.Text(icon.FileName, 255, "Nazwa pliku"); db.Icons.Add(icon); await db.SaveChangesAsync(); return Results.Created($"/api/v1/icons/{icon.Id}", new { icon.Id, icon.FileName });
        }).DisableAntiforgery();
        api.MapDelete("/icons/{id:guid}", async (Guid id, HubDb db) =>
        {
            var icon = await db.Icons.FindAsync(id) ?? throw new DomainError(404, "Nieznana ikona."); var key = "icon:" + id;
            foreach (var row in await db.Items.Where(x => x.IconKey == key).ToListAsync()) row.IconKey = "lucide:link";
            foreach (var row in await db.Tabs.Where(x => x.IconKey == key).ToListAsync()) row.IconKey = "lucide:folder";
            foreach (var row in await db.Sections.Where(x => x.IconKey == key).ToListAsync()) row.IconKey = "lucide:folder";
            db.Icons.Remove(icon); await db.SaveChangesAsync(); return Results.NoContent();
        });
    }
    public static string? Detect(byte[] b)
    {
        if (b.Length < 12) return null;
        if (b.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10})) return "image/png";
        if (b[0] == 255 && b[1] == 216 && b[2] == 255) return "image/jpeg";
        if (b.AsSpan(0,6).SequenceEqual("GIF87a"u8) || b.AsSpan(0,6).SequenceEqual("GIF89a"u8)) return "image/gif";
        if (b.AsSpan(0,4).SequenceEqual("RIFF"u8) && b.AsSpan(8,4).SequenceEqual("WEBP"u8)) return "image/webp";
        if (b[0] == 0 && b[1] == 0 && b[2] == 1 && b[3] == 0) return "image/x-icon";
        return null;
    }
}
