using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaintenanceAssignedToUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectionsAgentActions_Organizations_OrganizationId",
                table: "CollectionsAgentActions");

            migrationBuilder.DropIndex(
                name: "IX_CollectionsAgentActions_OrganizationId_CreatedAt",
                table: "CollectionsAgentActions");

            migrationBuilder.AlterColumn<string>(
                name: "Message",
                table: "CollectionsAgentActions",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AlterColumn<bool>(
                name: "IsManual",
                table: "CollectionsAgentActions",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "CollectionsAgentActions",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AlterColumn<string>(
                name: "ActionType",
                table: "CollectionsAgentActions",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<long>(
                name: "AssignedToUserId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CollectionsAgentActions_OrganizationId",
                table: "CollectionsAgentActions",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_CollectionsAgentActions_Organizations_OrganizationId",
                table: "CollectionsAgentActions",
                column: "OrganizationId",
                principalSchema: "organization",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectionsAgentActions_Organizations_OrganizationId",
                table: "CollectionsAgentActions");

            migrationBuilder.DropIndex(
                name: "IX_CollectionsAgentActions_OrganizationId",
                table: "CollectionsAgentActions");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.AlterColumn<string>(
                name: "Message",
                table: "CollectionsAgentActions",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<bool>(
                name: "IsManual",
                table: "CollectionsAgentActions",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "CollectionsAgentActions",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AlterColumn<string>(
                name: "ActionType",
                table: "CollectionsAgentActions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_CollectionsAgentActions_OrganizationId_CreatedAt",
                table: "CollectionsAgentActions",
                columns: new[] { "OrganizationId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_CollectionsAgentActions_Organizations_OrganizationId",
                table: "CollectionsAgentActions",
                column: "OrganizationId",
                principalSchema: "organization",
                principalTable: "Organizations",
                principalColumn: "Id");
        }
    }
}
