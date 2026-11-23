using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PersonalHub.Api.Infrastructure.Persistence.Migrations;

[DbContext(typeof(HubDb))]
[Migration("20261123110000_AutomaticFavicons")]
public sealed class AutomaticFavicons : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "Items"
            SET "IconKey" = 'auto:favicon', "Version" = "Version" + 1
            WHERE "IconKey" = 'lucide:link' AND "Url" IS NOT NULL
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE "Items" SET "IconKey" = 'lucide:link' WHERE "IconKey" = 'auto:favicon'
            """);
    }
}
