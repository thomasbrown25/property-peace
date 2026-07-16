using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using brownstone_hub_api.Data;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(DataContext))]
    [Migration("20260626194034_AddDurableCollectionsFollowUpHistory")]
    public partial class AddDurableCollectionsFollowUpHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectionsAgentActions_Leases_LeaseId",
                table: "CollectionsAgentActions");

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

            migrationBuilder.AddColumn<long>(
                name: "TenantId",
                table: "CollectionsAgentActions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantNameSnapshot",
                table: "CollectionsAgentActions",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PropertyNameSnapshot",
                table: "CollectionsAgentActions",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UnitNameSnapshot",
                table: "CollectionsAgentActions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FollowUpType",
                table: "CollectionsAgentActions",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InAppMessage",
                table: "CollectionsAgentActions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailSubject",
                table: "CollectionsAgentActions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailMessage",
                table: "CollectionsAgentActions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ConversationId",
                table: "CollectionsAgentActions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "MessageId",
                table: "CollectionsAgentActions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailSent",
                table: "CollectionsAgentActions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SuppressionDays",
                table: "CollectionsAgentActions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CollectionsAgentActions_MessageId",
                table: "CollectionsAgentActions",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_CollectionsAgentActions_OrganizationId_CreatedAt",
                table: "CollectionsAgentActions",
                columns: new[] { "OrganizationId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_CollectionsAgentActions_Leases_LeaseId",
                table: "CollectionsAgentActions",
                column: "LeaseId",
                principalSchema: "lease",
                principalTable: "Leases",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectionsAgentActions_Leases_LeaseId",
                table: "CollectionsAgentActions");

            migrationBuilder.DropIndex(
                name: "IX_CollectionsAgentActions_MessageId",
                table: "CollectionsAgentActions");

            migrationBuilder.DropIndex(
                name: "IX_CollectionsAgentActions_OrganizationId_CreatedAt",
                table: "CollectionsAgentActions");

            migrationBuilder.DropColumn(name: "TenantId", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "TenantNameSnapshot", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "PropertyNameSnapshot", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "UnitNameSnapshot", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "FollowUpType", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "InAppMessage", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "EmailSubject", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "EmailMessage", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "ConversationId", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "MessageId", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "EmailSent", table: "CollectionsAgentActions");
            migrationBuilder.DropColumn(name: "SuppressionDays", table: "CollectionsAgentActions");

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

            migrationBuilder.AddForeignKey(
                name: "FK_CollectionsAgentActions_Leases_LeaseId",
                table: "CollectionsAgentActions",
                column: "LeaseId",
                principalSchema: "lease",
                principalTable: "Leases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
