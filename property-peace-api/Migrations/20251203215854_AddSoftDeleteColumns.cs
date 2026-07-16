using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftDeleteColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId",
                table: "ConversationParticipants");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "Tenants",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "TenantDocuments",
                newName: "IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_TenantDocuments_TenantId_IsActive",
                table: "TenantDocuments",
                newName: "IX_TenantDocuments_TenantId_IsDeleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "Properties",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "Leases",
                newName: "IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_Leases_UnitId_IsActive",
                table: "Leases",
                newName: "IX_Leases_UnitId_IsDeleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "DocumentTemplates",
                newName: "IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_DocumentTemplates_LandlordId_IsActive",
                table: "DocumentTemplates",
                newName: "IX_DocumentTemplates_LandlordId_IsDeleted");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "ConversationParticipants",
                newName: "IsDeleted");

            migrationBuilder.RenameIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId_IsActive",
                table: "ConversationParticipants",
                newName: "IX_ConversationParticipants_ConversationId_UserId_IsDeleted");

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "TenantDocuments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Properties",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "DocumentTemplates",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ConversationParticipants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId",
                table: "ConversationParticipants",
                columns: new[] { "ConversationId", "UserId" },
                unique: true,
                filter: "[IsDeleted] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId",
                table: "ConversationParticipants");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "TenantDocuments");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "DocumentTemplates");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ConversationParticipants");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "Tenants",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "TenantDocuments",
                newName: "IsActive");

            migrationBuilder.RenameIndex(
                name: "IX_TenantDocuments_TenantId_IsDeleted",
                table: "TenantDocuments",
                newName: "IX_TenantDocuments_TenantId_IsActive");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "Properties",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "Leases",
                newName: "IsActive");

            migrationBuilder.RenameIndex(
                name: "IX_Leases_UnitId_IsDeleted",
                table: "Leases",
                newName: "IX_Leases_UnitId_IsActive");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "DocumentTemplates",
                newName: "IsActive");

            migrationBuilder.RenameIndex(
                name: "IX_DocumentTemplates_LandlordId_IsDeleted",
                table: "DocumentTemplates",
                newName: "IX_DocumentTemplates_LandlordId_IsActive");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "ConversationParticipants",
                newName: "IsActive");

            migrationBuilder.RenameIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId_IsDeleted",
                table: "ConversationParticipants",
                newName: "IX_ConversationParticipants_ConversationId_UserId_IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationParticipants_ConversationId_UserId",
                table: "ConversationParticipants",
                columns: new[] { "ConversationId", "UserId" },
                unique: true,
                filter: "[IsActive] = 1");
        }
    }
}
