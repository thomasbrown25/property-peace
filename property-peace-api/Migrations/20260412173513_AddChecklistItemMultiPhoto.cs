using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddChecklistItemMultiPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhotoBlobNames",
                schema: "checklist",
                table: "ChecklistItems",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoBlobUrls",
                schema: "checklist",
                table: "ChecklistItems",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoBlobNames",
                schema: "checklist",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "PhotoBlobUrls",
                schema: "checklist",
                table: "ChecklistItems");
        }
    }
}
