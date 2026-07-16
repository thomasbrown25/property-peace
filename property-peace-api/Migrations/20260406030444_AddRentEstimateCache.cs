using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddRentEstimateCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "rentcast");

            migrationBuilder.AddColumn<bool>(
                name: "AdminNewUserNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AdminSubscriptionNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ApplicationCompletionInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "LeaseExpirationInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "MaintenanceUpdatesInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "NewTenantNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "OverdueAlertsInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentConfirmationsInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RentRemindersInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TenantMessagesInApp",
                schema: "communication",
                table: "NotificationSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RentEstimateCache",
                schema: "rentcast",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CacheKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ZipCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Bedrooms = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Bathrooms = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SquareFeet = table.Column<int>(type: "int", nullable: true),
                    PropertyType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RentEstimate = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    RentRangeLow = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    RentRangeHigh = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    ComparablesJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsError = table.Column<bool>(type: "bit", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentEstimateCache", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RentEstimateCache_CacheKey",
                schema: "rentcast",
                table: "RentEstimateCache",
                column: "CacheKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RentEstimateCache_ExpiresAt",
                schema: "rentcast",
                table: "RentEstimateCache",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RentEstimateCache",
                schema: "rentcast");

            migrationBuilder.DropColumn(
                name: "AdminNewUserNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "AdminSubscriptionNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "ApplicationCompletionInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "LeaseExpirationInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "MaintenanceUpdatesInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "NewTenantNotificationsInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "OverdueAlertsInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "PaymentConfirmationsInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "RentRemindersInApp",
                schema: "communication",
                table: "NotificationSettings");

            migrationBuilder.DropColumn(
                name: "TenantMessagesInApp",
                schema: "communication",
                table: "NotificationSettings");
        }
    }
}
