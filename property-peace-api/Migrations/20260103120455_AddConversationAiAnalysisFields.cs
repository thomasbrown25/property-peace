using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddConversationAiAnalysisFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AiSummary",
                table: "Conversations",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiSummaryUpdatedAt",
                table: "Conversations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasUrgentItems",
                table: "Conversations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UrgentItemsDetectedAt",
                table: "Conversations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UrgentItemsJson",
                table: "Conversations",
                type: "nvarchar(max)",
                maxLength: 5000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_HasUrgentItems",
                table: "Conversations",
                column: "HasUrgentItems");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_LandlordId_HasUrgentItems",
                table: "Conversations",
                columns: new[] { "LandlordId", "HasUrgentItems" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Conversations_HasUrgentItems",
                table: "Conversations");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_LandlordId_HasUrgentItems",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "AiSummary",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "AiSummaryUpdatedAt",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "HasUrgentItems",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "UrgentItemsDetectedAt",
                table: "Conversations");

            migrationBuilder.DropColumn(
                name: "UrgentItemsJson",
                table: "Conversations");
        }
    }
}
