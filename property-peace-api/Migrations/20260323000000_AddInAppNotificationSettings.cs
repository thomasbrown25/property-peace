using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddInAppNotificationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "OverdueAlertsInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RentRemindersInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentConfirmationsInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "MaintenanceUpdatesInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "LeaseExpirationInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "NewTenantNotificationsInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ApplicationCompletionInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "TenantMessagesInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsInApp",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "OverdueAlertsInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "RentRemindersInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "PaymentConfirmationsInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "MaintenanceUpdatesInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "LeaseExpirationInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "NewTenantNotificationsInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "ApplicationCompletionInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "TenantMessagesInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "AdminSubscriptionNotificationsInApp", table: "NotificationSettings");
            migrationBuilder.DropColumn(name: "AdminNewUserNotificationsInApp", table: "NotificationSettings");
        }
    }
}
