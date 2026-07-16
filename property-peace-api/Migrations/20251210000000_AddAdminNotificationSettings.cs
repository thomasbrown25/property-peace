using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminNotificationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsEmail",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsPhone",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsEmail",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsPhone",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminSubscriptionNotificationsEmail",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminSubscriptionNotificationsPhone",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminNewUserNotificationsEmail",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminNewUserNotificationsPhone",
                table: "NotificationSettings");
        }
    }
}

