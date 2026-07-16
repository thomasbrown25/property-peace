using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddConversationLinkToMaintenanceRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ConversationId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "MaintenanceRequestId",
                schema: "communication",
                table: "Conversations",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests",
                column: "ConversationId1");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_Conversations_ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests",
                column: "ConversationId1",
                principalSchema: "communication",
                principalTable: "Conversations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_Conversations_ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "ConversationId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "ConversationId1",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "MaintenanceRequestId",
                schema: "communication",
                table: "Conversations");
        }
    }
}
