using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddSupportTicketThreads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastActivityAt",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TicketNumber",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE [admin].[SupportAndFeedbacks]
                SET [LastActivityAt] = [CreatedAt],
                    [ResolvedAt] = CASE WHEN [IsResolved] = 1 THEN [CreatedAt] ELSE NULL END,
                    [TicketNumber] = CONCAT('PP-', DATEPART(year, [CreatedAt]), '-', CASE WHEN LEN(CONVERT(varchar(20), [Id])) >= 6 THEN CONVERT(varchar(20), [Id]) ELSE RIGHT(CONCAT('000000', [Id]), 6) END);
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "LastActivityAt",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "TicketNumber",
                schema: "admin",
                table: "SupportAndFeedbacks",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupportAndFeedbacks_ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks",
                column: "ConversationId",
                unique: true,
                filter: "[ConversationId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SupportAndFeedbacks_TicketNumber",
                schema: "admin",
                table: "SupportAndFeedbacks",
                column: "TicketNumber",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SupportAndFeedbacks_Conversations_ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks",
                column: "ConversationId",
                principalSchema: "communication",
                principalTable: "Conversations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupportAndFeedbacks_Conversations_ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_SupportAndFeedbacks_ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropIndex(
                name: "IX_SupportAndFeedbacks_TicketNumber",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropColumn(
                name: "ConversationId",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropColumn(
                name: "LastActivityAt",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                schema: "admin",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropColumn(
                name: "TicketNumber",
                schema: "admin",
                table: "SupportAndFeedbacks");
        }
    }
}
