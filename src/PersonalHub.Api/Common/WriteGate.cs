namespace PersonalHub.Api.Common;
// One runtime replica, serialized writes: validation, reordering and import cannot race.
public sealed class WriteGate { public SemaphoreSlim Semaphore { get; } = new(1, 1); }
public class WriteGateMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, WriteGate gate)
    {
        if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)) { await next(context); return; }
        await gate.Semaphore.WaitAsync(context.RequestAborted);
        try { await next(context); } finally { gate.Semaphore.Release(); }
    }
}
