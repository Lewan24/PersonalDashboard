using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalHub.Api.Infrastructure.Persistence.Migrations
{
    public partial class ItemShowUrl : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShowUrl",
                table: "Items",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ShowUrl", table: "Items");
        }
    }
}
