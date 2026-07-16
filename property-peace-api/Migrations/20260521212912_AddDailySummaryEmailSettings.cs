using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDailySummaryEmailSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DailySummaryEmail",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "DailySummaryUnsubscribeToken",
                schema: "communication",
                table: "NotificationSettings",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailySummaryEmail",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "DailySummaryUnsubscribeToken",
                schema: "communication",
                table: "NotificationSettings");
        }
    }
}
