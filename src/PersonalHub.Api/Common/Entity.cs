namespace PersonalHub.Api.Common;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int Version { get; set; } = 1;
}

public sealed class DomainError(int status, string message, object? current = null) : Exception(message)
{
    public int Status { get; } = status;
    public object? Current { get; } = current;
}
