using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PersistChecklistRoomNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "CounterpartChecklistId",
                schema: "checklist",
                table: "Checklists",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RoomNamesJson",
                schema: "checklist",
                table: "Checklists",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CounterpartChecklistId",
                schema: "checklist",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "RoomNamesJson",
                schema: "checklist",
                table: "Checklists");
        }
    }
}
