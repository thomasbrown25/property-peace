using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaintenanceAssignmentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedAt",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "AssignedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedContactEmail",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedContactName",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedContactPhone",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AssignedToType",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssignedAt",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedContactEmail",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedContactName",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedContactPhone",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "AssignedToType",
                schema: "maintenance",
                table: "MaintenanceRequests");
        }
    }
}
