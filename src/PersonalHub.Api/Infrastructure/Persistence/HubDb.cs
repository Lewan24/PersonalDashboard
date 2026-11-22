using Microsoft.EntityFrameworkCore;
using PersonalHub.Api.Common;
using PersonalHub.Api.Features.Dashboard;
using PersonalHub.Api.Features.Tasks;
using PersonalHub.Api.Features.Settings;

namespace PersonalHub.Api.Infrastructure.Persistence;

public class HubDb(DbContextOptions<HubDb> options, TimeProvider clock) : DbContext(options)
{
    public DbSet<DashboardTab> Tabs => Set<DashboardTab>();
    public DbSet<DashboardSection> Sections => Set<DashboardSection>();
    public DbSet<DashboardItem> Items => Set<DashboardItem>();
    public DbSet<TaskColumn> Columns => Set<TaskColumn>();
    public DbSet<HubTask> Tasks => Set<HubTask>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<IconAsset> Icons => Set<IconAsset>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<SchemaMetadata> Metadata => Set<SchemaMetadata>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppSetting>().HasKey(x => x.Key);
        b.Entity<SchemaMetadata>().HasKey(x => x.Key);
        b.Entity<DashboardSection>().HasOne<DashboardTab>().WithMany().HasForeignKey(x => x.TabId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<DashboardSection>().HasIndex(x => new { x.TabId, x.SortOrder });
        b.Entity<DashboardSection>().Property(x => x.WidthPercent).HasDefaultValue(100);
        b.Entity<DashboardItem>().HasOne<DashboardSection>().WithMany().HasForeignKey(x => x.SectionId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<DashboardItem>().HasIndex(x => new { x.SectionId, x.SortOrder });
        b.Entity<DashboardItem>().HasIndex(x => x.IsFavorite);
        b.Entity<DashboardItem>().HasMany(x => x.Tags).WithMany().UsingEntity("DashboardItemTag");
        b.Entity<Tag>().Property(x => x.Name).UseCollation("NOCASE");
        b.Entity<Tag>().HasIndex(x => x.Name).IsUnique();
        b.Entity<HubTask>().HasOne<TaskColumn>().WithMany().HasForeignKey(x => x.ColumnId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<HubTask>().HasOne<TaskColumn>().WithMany().HasForeignKey(x => x.LastActiveColumnId).OnDelete(DeleteBehavior.SetNull);
        b.Entity<HubTask>().HasOne<DashboardItem>().WithMany().HasForeignKey(x => x.RelatedDashboardItemId).OnDelete(DeleteBehavior.SetNull);
        b.Entity<HubTask>().HasIndex(x => new { x.ColumnId, x.SortOrder });
        b.Entity<HubTask>().HasIndex(x => x.DueDate).HasFilter("CompletedAt IS NULL");
        b.Entity<HubTask>().HasIndex(x => new { x.IsArchived, x.CompletedAt });
        b.Entity<HubTask>().HasMany(x => x.Tags).WithMany().UsingEntity("TaskTag");
        b.Entity<HubTask>().HasMany(x => x.Checklist).WithOne().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<HubTask>().HasMany(x => x.Links).WithOne().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Cascade);
        foreach (var type in b.Model.GetEntityTypes().Where(x => typeof(Entity).IsAssignableFrom(x.ClrType)))
        {
            b.Entity(type.ClrType).Property(nameof(Entity.Version)).IsConcurrencyToken();
            b.Entity(type.ClrType).Property<DateTime>(nameof(Entity.CreatedAt)).HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
            b.Entity(type.ClrType).Property<DateTime>(nameof(Entity.UpdatedAt)).HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        }
        b.Entity<HubTask>().Property(x => x.CompletedAt).HasConversion(v => v, v => v == null ? null : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc));
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default) entry.Entity.CreatedAt = now;
                if (entry.Entity.UpdatedAt == default) entry.Entity.UpdatedAt = now;
            }
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.Version = (int)entry.OriginalValues[nameof(Entity.Version)]! + 1;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
