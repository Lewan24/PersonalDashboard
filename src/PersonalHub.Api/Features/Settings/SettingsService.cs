using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Infrastructure.Persistence;

namespace PersonalHub.Api.Features.Settings;
public class SettingsService(HubDb db, TimeProvider clock)
{
    public static readonly Dictionary<string, object> Defaults = new()
    {
        ["timezone"] = "Europe/Warsaw", ["theme"] = "dark", ["accent"] = "#cc0000",
        ["density"] = "compact", ["radius"] = 12, ["width"] = 1440, ["columns"] = 3,
        ["clockVisible"] = true, ["clockSeconds"] = false, ["clockFormat"] = "24",
        ["dateFormat"] = "long", ["iconSize"] = 24, ["language"] = "pl",
        ["showOverdueInToday"] = false, ["quickAccess"] = true, ["externalSearch"] = ""
    };
    public async Task<Dictionary<string, JsonElement>> Read()
    {
        var result = Defaults.ToDictionary(x => x.Key, x => JsonSerializer.SerializeToElement(x.Value));
        foreach (var row in await db.Settings.AsNoTracking().ToListAsync()) result[row.Key] = JsonSerializer.Deserialize<JsonElement>(row.ValueJson);
        return result;
    }
    public static void Validate(Dictionary<string, JsonElement> values)
    {
        foreach (var (key, value) in values)
        {
            if (!Defaults.TryGetValue(key, out var defaultValue)) throw new DomainError(422, "Nieznane ustawienie: " + key);
            var expected = JsonSerializer.SerializeToElement(defaultValue).ValueKind;
            if (value.ValueKind != expected && !((expected is JsonValueKind.True or JsonValueKind.False) && (value.ValueKind is JsonValueKind.True or JsonValueKind.False))) throw new DomainError(422, "Niepoprawny typ ustawienia: " + key);
        }
        if (values.TryGetValue("timezone", out var zone))
            try { TimeZoneInfo.FindSystemTimeZoneById(zone.GetString()!); } catch { throw new DomainError(422, "Nieznana strefa IANA."); }
        if (values.TryGetValue("theme", out var theme) && theme.GetString() is not ("dark" or "light" or "system")) throw new DomainError(422, "Nieznany motyw.");
        foreach (var (key, min, max) in new[] { ("columns", 1, 6), ("radius", 0, 24), ("width", 640, 1920), ("iconSize", 16, 64) })
            if (values.TryGetValue(key, out var number) && (!number.TryGetInt32(out var n) || n < min || n > max)) throw new DomainError(422, "Niepoprawna wartość: " + key);
        if (values.TryGetValue("accent", out var accent)) Validation.Color(accent.GetString()!);
        if (values.TryGetValue("externalSearch", out var search) && search.GetString() != "") Validation.Url(search.GetString()!.Replace("{q}", "test"));
        if (values.TryGetValue("language", out var lang) && lang.GetString() != "pl") throw new DomainError(422, "Dostępny język: pl.");
        if (values.TryGetValue("density", out var density) && density.GetString() is not ("compact" or "comfortable")) throw new DomainError(422, "Nieznana gęstość.");
    }
    public async Task Write(Dictionary<string, JsonElement> values)
    {
        Validate(values);
        foreach (var (key, value) in values)
        {
            var row = await db.Settings.FindAsync(key);
            if (row == null) db.Settings.Add(row = new AppSetting { Key = key });
            row.ValueJson = value.GetRawText(); row.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        }
        await db.SaveChangesAsync();
    }
    public async Task<DateOnly> Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById((await Read())["timezone"].GetString()!)).DateTime);
}
