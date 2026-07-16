using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsUrgentToMessage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUrgent",
                table: "Messages",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UrgentDetectedAt",
                table: "Messages",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_IsUrgent",
                table: "Messages",
                columns: new[] { "ConversationId", "IsUrgent" });

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IsUrgent",
                table: "Messages",
                column: "IsUrgent");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_IsUrgent",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_IsUrgent",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "IsUrgent",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "UrgentDetectedAt",
                table: "Messages");
        }
    }
}
