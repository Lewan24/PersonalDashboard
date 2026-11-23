namespace PersonalHub.Api.Common;
// One runtime replica, serialized writes: validation, reordering and import cannot race.
public sealed class WriteGate
{
    private long revision;
    public SemaphoreSlim Semaphore { get; } = new(1, 1);
    public long Revision => Interlocked.Read(ref revision);
    public void MarkChanged() => Interlocked.Increment(ref revision);
}
public class WriteGateMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, WriteGate gate)
    {
        if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)) { await next(context); return; }
        await gate.Semaphore.WaitAsync(context.RequestAborted);
        try
        {
            if (context.Request.Path.StartsWithSegments("/api/v1"))
            {
                context.Response.OnStarting(() =>
                {
                    if (context.Response.StatusCode is >= 200 and < 300) gate.MarkChanged();
                    return Task.CompletedTask;
                });
            }
            await next(context);
        }
        finally { gate.Semaphore.Release(); }
    }
}
