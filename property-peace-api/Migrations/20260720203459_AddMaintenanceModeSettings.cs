using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaintenanceModeSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MaintenanceMessage",
                table: "AdminSettings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "MaintenanceModeEnabled",
                table: "AdminSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceSupportEmail",
                table: "AdminSettings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceTitle",
                table: "AdminSettings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaintenanceMessage",
                table: "AdminSettings");

            migrationBuilder.DropColumn(
                name: "MaintenanceModeEnabled",
                table: "AdminSettings");

            migrationBuilder.DropColumn(
                name: "MaintenanceSupportEmail",
                table: "AdminSettings");

            migrationBuilder.DropColumn(
                name: "MaintenanceTitle",
                table: "AdminSettings");
        }
    }
}
