using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAISummaryPreferencesToUserSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryCheckApplicationsSentSigned",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryCheckMoveInChecklist",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryCheckMoveOutChecklist",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryCheckTenantAccounts",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryCheckUnpaidSecurityDeposits",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AiSummaryEnabled",
                table: "UserSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiSummaryCheckApplicationsSentSigned",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "AiSummaryCheckMoveInChecklist",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "AiSummaryCheckMoveOutChecklist",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "AiSummaryCheckTenantAccounts",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "AiSummaryCheckUnpaidSecurityDeposits",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "AiSummaryEnabled",
                table: "UserSettings");
        }
    }
}
