using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationIdToNotifications2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsEmail",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsPhone",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsEmail",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsPhone",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminNewUserNotificationsEmail",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminNewUserNotificationsPhone",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminSubscriptionNotificationsEmail",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminSubscriptionNotificationsPhone",
                table: "NotificationSettings");
        }
    }
}
