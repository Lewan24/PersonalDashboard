using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Settings;
using PersonalHub.Api.Infrastructure.Persistence;

namespace PersonalHub.Api.Features.Backup;

public sealed record DatabaseContents(ExportDocument Document, List<AppSetting> Settings, List<SchemaMetadata> Metadata);

public static class SqliteSnapshot
{
    public const string RestorePath = "/api/v1/backup/restore";
    public const string ContentType = "application/vnd.sqlite3";
    public const long MaxUploadBytes = 512L * 1024 * 1024;

    public static async Task<DatabaseContents> Read(Stream upload, TimeProvider clock, CancellationToken cancellationToken)
    {
        var directory = Directory.CreateTempSubdirectory("personal-hub-restore-");
        var path = Path.Combine(directory.FullName, "upload.db");
        try
        {
            await SaveUpload(upload, path, cancellationToken);
            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = path, Mode = SqliteOpenMode.ReadWrite, Pooling = false, ForeignKeys = true, DefaultTimeout = 5,
            }.ToString();
            var options = new DbContextOptionsBuilder<HubDb>().UseSqlite(connectionString).Options;
            await using var source = new HubDb(options, clock);
            await source.Database.OpenConnectionAsync(cancellationToken);
            var connection = (SqliteConnection)source.Database.GetDbConnection();
            await CheckSchema(source, connection, cancellationToken);

            var applied = (await source.Database.GetAppliedMigrationsAsync(cancellationToken)).ToArray();
            var known = source.Database.GetMigrations().ToArray();
            if (applied.Length == 0 || !applied.SequenceEqual(known.Take(applied.Length)))
                throw new DomainError(422, "Plik pochodzi z nieobsługiwanej wersji Personal Hub.");
            if (applied.Length < known.Length) await source.Database.MigrateAsync(cancellationToken);

            using var check = connection.CreateCommand();
            check.CommandText = "PRAGMA integrity_check(1)";
            if (await check.ExecuteScalarAsync(cancellationToken) is not "ok")
                throw new DomainError(422, "Plik kopii SQLite jest uszkodzony.");
            check.CommandText = "PRAGMA foreign_key_check";
            if (await check.ExecuteScalarAsync(cancellationToken) is not null)
                throw new DomainError(422, "Plik kopii SQLite zawiera niepoprawne powiązania.");

            var document = await TransferService.ExportFrom(source, new SettingsService(source, clock));
            TransferService.Validate(document);
            return new DatabaseContents(document,
                await source.Settings.AsNoTracking().ToListAsync(cancellationToken),
                await source.Metadata.AsNoTracking().ToListAsync(cancellationToken));
        }
        catch (Exception error) when (error is SqliteException or FormatException or InvalidCastException or OverflowException)
        {
            throw new DomainError(422, "Plik nie jest poprawną kopią SQLite Personal Hub.");
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    private static async Task SaveUpload(Stream upload, string path, CancellationToken cancellationToken)
    {
        var header = new byte[16];
        if (await upload.ReadAtLeastAsync(header, header.Length, false, cancellationToken) != header.Length ||
            !header.AsSpan().SequenceEqual("SQLite format 3\0"u8))
            throw new DomainError(422, "Wybierz plik kopii SQLite Personal Hub.");

        await using var file = File.Create(path);
        await file.WriteAsync(header, cancellationToken);
        var buffer = new byte[81920];
        int length;
        while ((length = await upload.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (file.Length + length > MaxUploadBytes)
                throw new DomainError(413, "Maksymalny rozmiar kopii SQLite to 512 MB.");
            await file.WriteAsync(buffer.AsMemory(0, length), cancellationToken);
        }
    }

    private static async Task CheckSchema(HubDb source, SqliteConnection connection, CancellationToken cancellationToken)
    {
        var tables = source.Model.GetEntityTypes().Select(x => x.GetTableName()).ToHashSet(StringComparer.Ordinal);
        tables.Add("__EFMigrationsHistory");
        tables.Add("__EFMigrationsLock");

        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA trusted_schema=OFF";
        await command.ExecuteNonQueryAsync(cancellationToken);
        command.CommandText = "SELECT name, type FROM pragma_table_list WHERE schema='main' AND name NOT GLOB 'sqlite_*'";
        var hasLock = false;
        await using (var rows = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await rows.ReadAsync(cancellationToken))
            {
                var name = rows.GetString(0);
                if (rows.GetString(1) != "table" || !tables.Contains(name))
                    throw new DomainError(422, "Plik nie ma obsługiwanego schematu Personal Hub.");
                hasLock |= name == "__EFMigrationsLock";
            }
        }
        command.CommandText = "SELECT 1 FROM sqlite_schema WHERE type='trigger' LIMIT 1";
        if (await command.ExecuteScalarAsync(cancellationToken) is not null)
            throw new DomainError(422, "Plik nie ma obsługiwanego schematu Personal Hub.");
        if (hasLock)
        {
            command.CommandText = "SELECT 1 FROM __EFMigrationsLock LIMIT 1";
            if (await command.ExecuteScalarAsync(cancellationToken) is not null)
                throw new DomainError(422, "Kopia zawiera niedokończoną migrację bazy.");
        }
    }
}
