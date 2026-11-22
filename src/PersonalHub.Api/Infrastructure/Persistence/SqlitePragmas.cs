using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
namespace PersonalHub.Api.Infrastructure.Persistence;
public sealed class SqlitePragmas : DbConnectionInterceptor
{
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand(); command.CommandText = "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;"; command.ExecuteNonQuery();
    }
    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        using var command = connection.CreateCommand(); command.CommandText = "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;"; await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
