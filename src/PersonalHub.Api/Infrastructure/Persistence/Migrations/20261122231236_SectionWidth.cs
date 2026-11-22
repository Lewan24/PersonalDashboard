using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalHub.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SectionWidth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WidthPercent",
                table: "Sections",
                type: "INTEGER",
                nullable: false,
                defaultValue: 100);
            // Adopt the new default; preserve user-selected colors other than the old default.
            foreach (var table in new[] { "Tabs", "Sections", "Items", "Tags", "Columns" })
            {
                var column = table is "Tags" or "Columns" ? "Color" : "AccentColor";
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"{column}\" = '#cc0000', \"Version\" = \"Version\" + 1 WHERE lower(\"{column}\") = '#a5c8ae';");
            }
            migrationBuilder.Sql("UPDATE \"Settings\" SET \"ValueJson\" = '\"#cc0000\"' WHERE \"Key\" = 'accent' AND lower(\"ValueJson\") = '\"#a5c8ae\"';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WidthPercent",
                table: "Sections");
        }
    }
}
