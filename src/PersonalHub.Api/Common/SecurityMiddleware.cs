using PersonalHub.Api.Features.Backup;

namespace PersonalHub.Api.Common;
public class SecurityMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var allowed = (configuration["AllowedHosts"] ?? "localhost;127.0.0.1;[::1]").Split(';', StringSplitOptions.RemoveEmptyEntries);
        if (!allowed.Any(h => string.Equals(h.Trim('[', ']'), request.Host.Host.Trim('[', ']'), StringComparison.OrdinalIgnoreCase)))
        { await Results.Problem(statusCode: 400, title: "Niedozwolony Host.").ExecuteAsync(context); return; }
        context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; img-src 'self' data: http: https:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
        context.Response.Headers.XContentTypeOptions = "nosniff";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        if (HttpMethods.IsPost(request.Method) || HttpMethods.IsPut(request.Method) || HttpMethods.IsPatch(request.Method) || HttpMethods.IsDelete(request.Method))
        {
            if (request.Headers["X-PersonalHub-Client"] != "1") { await Results.Problem(statusCode: 403, title: "Wymagany nagłówek klienta.").ExecuteAsync(context); return; }
            var source = request.Headers.Origin.FirstOrDefault() ?? request.Headers.Referer.FirstOrDefault();
            if (source != null && (!Uri.TryCreate(source, UriKind.Absolute, out var origin) || !string.Equals(origin.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase) || origin.Scheme != request.Scheme))
            { await Results.Problem(statusCode: 403, title: "Niedozwolone źródło żądania.").ExecuteAsync(context); return; }
            var multipart = request.Path == "/api/v1/icons" && request.HasFormContentType;
            var restoring = request.Path == SqliteSnapshot.RestorePath && HttpMethods.IsPost(request.Method);
            var accepted = restoring
                ? string.Equals(request.GetTypedHeaders().ContentType?.MediaType.Value, SqliteSnapshot.ContentType, StringComparison.OrdinalIgnoreCase)
                : multipart || request.HasJsonContentType();
            if (!accepted)
            {
                await Results.Problem(statusCode: 415, title: restoring ? "Wymagany plik kopii SQLite." : "Wymagane application/json.").ExecuteAsync(context);
                return;
            }
        }
        await next(context);
    }
}
