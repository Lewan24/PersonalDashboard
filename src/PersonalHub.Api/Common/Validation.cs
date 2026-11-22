using System.Text.Json;
using System.Text.RegularExpressions;
namespace PersonalHub.Api.Common;

public static partial class Validation
{
    public static void Text(string? text, int max, string name, bool required = true)
    {
        if (text == null || text.Length > max || (required && string.IsNullOrWhiteSpace(text))) throw new DomainError(422, $"{name}: wymagana wartość, maksymalnie {max} znaków.");
    }
    public static void Url(string? url)
    {
        if (url?.Length > 2048 || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || string.IsNullOrEmpty(uri.Host)) throw new DomainError(422, "URL musi używać http lub https (maks. 2048 znaków).");
    }
    public static void Color(string color)
    {
        if (!HexColor().IsMatch(color)) throw new DomainError(422, "Kolor musi mieć format #rrggbb.");
    }
    public static void Version(Entity entity, JsonElement body, bool required = false)
    {
        if (!body.TryGetProperty("expectedVersion", out var value)) { if (required) throw new DomainError(422, "Wymagane expectedVersion."); return; }
        if (!value.TryGetInt32(out var version) || version != entity.Version) throw new DomainError(409, "Dane zmieniły się w innym oknie. Odśwież i ponów.", entity);
    }
    public static T Patch<T>(T current, JsonElement body, params string[] allowed) where T : class
    {
        if (body.ValueKind != JsonValueKind.Object) throw new DomainError(400, "Oczekiwany obiekt JSON.");
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        foreach (var field in body.EnumerateObject())
        {
            if (field.Name == "expectedVersion") continue;
            if (!allowed.Contains(field.Name)) throw new DomainError(422, "Nieznane lub tylko do odczytu pole: " + field.Name);
            if (field.Name == "tagIds") continue;
            var property = typeof(T).GetProperties().Single(p => string.Equals(p.Name, field.Name, StringComparison.OrdinalIgnoreCase));
            property.SetValue(current, field.Value.Deserialize(property.PropertyType, options));
        }
        return current;
    }
    public static Guid Id(JsonElement body, string key) => body.TryGetProperty(key, out var p) && p.TryGetGuid(out var id) ? id : throw new DomainError(422, "Wymagane ID: " + key);
    public static int Index(JsonElement body) => body.TryGetProperty("targetIndex", out var p) && p.TryGetInt32(out var i) && i >= 0 ? i : throw new DomainError(422, "Wymagana nieujemna pozycja.");
    [GeneratedRegex("^#[0-9a-fA-F]{6}$")] private static partial Regex HexColor();
}
