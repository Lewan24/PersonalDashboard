using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Infrastructure.Persistence;
namespace PersonalHub.Api.Features.Backup;

public class BackupService(HubDb db, TimeProvider clock)
{
    public string DirectoryPath => Path.Combine(Path.GetDirectoryName(Path.GetFullPath(db.Database.GetDbConnection().DataSource))!, "backups");
    public async Task<string> Create(string prefix = "backup")
    {
        Directory.CreateDirectory(DirectoryPath);
        var path = Path.Combine(DirectoryPath, $"{prefix}-{clock.GetUtcNow():yyyyMMdd-HHmmssfff}-{Guid.CreateVersion7():N}.db");
        await db.Database.OpenConnectionAsync();
        using (var destination = new SqliteConnection($"Data Source={path}"))
        {
            await destination.OpenAsync(); ((SqliteConnection)db.Database.GetDbConnection()).BackupDatabase(destination);
        }
        await db.Database.CloseConnectionAsync();
        if (prefix == "backup") foreach (var old in new DirectoryInfo(DirectoryPath).GetFiles("backup-*.db").OrderByDescending(f => f.Name).Skip(10)) old.Delete();
        return path;
    }
}
