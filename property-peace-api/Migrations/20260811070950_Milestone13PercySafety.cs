using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Milestone13PercySafety : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EventKey",
                schema: "percy",
                table: "AuditRecords",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE [percy].[AuditRecords] SET [EventKey] = CONCAT('legacy:', [Id]) WHERE [EventKey] IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "EventKey",
                schema: "percy",
                table: "AuditRecords",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "ChatOperations",
                schema: "percy",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ClientRequestId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: true),
                    UserMessageId = table.Column<long>(type: "bigint", nullable: true),
                    AssistantMessageId = table.Column<long>(type: "bigint", nullable: true),
                    CompletedResponseJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LeaseExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatOperations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatOperations_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "percy",
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatOperations_Messages_AssistantMessageId",
                        column: x => x.AssistantMessageId,
                        principalSchema: "percy",
                        principalTable: "Messages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatOperations_Messages_UserMessageId",
                        column: x => x.UserMessageId,
                        principalSchema: "percy",
                        principalTable: "Messages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatOperations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatOperations_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_EventKey",
                schema: "percy",
                table: "AuditRecords",
                column: "EventKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_AssistantMessageId",
                schema: "percy",
                table: "ChatOperations",
                column: "AssistantMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_ConversationId",
                schema: "percy",
                table: "ChatOperations",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_OrganizationId_UserId_ClientRequestId",
                schema: "percy",
                table: "ChatOperations",
                columns: new[] { "OrganizationId", "UserId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_Status_LeaseExpiresAt",
                schema: "percy",
                table: "ChatOperations",
                columns: new[] { "Status", "LeaseExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_UserId",
                schema: "percy",
                table: "ChatOperations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatOperations_UserMessageId",
                schema: "percy",
                table: "ChatOperations",
                column: "UserMessageId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatOperations",
                schema: "percy");

            migrationBuilder.DropIndex(
                name: "IX_AuditRecords_EventKey",
                schema: "percy",
                table: "AuditRecords");

            migrationBuilder.DropColumn(
                name: "EventKey",
                schema: "percy",
                table: "AuditRecords");
        }
    }
}
