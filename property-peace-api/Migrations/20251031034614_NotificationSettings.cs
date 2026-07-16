using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class NotificationSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationSettings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    EmailEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PhoneEnabled = table.Column<bool>(type: "bit", nullable: false),
                    EmailAddress = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    RentRemindersEmail = table.Column<bool>(type: "bit", nullable: false),
                    RentRemindersPhone = table.Column<bool>(type: "bit", nullable: false),
                    OverdueAlertsEmail = table.Column<bool>(type: "bit", nullable: false),
                    OverdueAlertsPhone = table.Column<bool>(type: "bit", nullable: false),
                    PaymentConfirmationsEmail = table.Column<bool>(type: "bit", nullable: false),
                    PaymentConfirmationsPhone = table.Column<bool>(type: "bit", nullable: false),
                    MaintenanceUpdatesEmail = table.Column<bool>(type: "bit", nullable: false),
                    MaintenanceUpdatesPhone = table.Column<bool>(type: "bit", nullable: false),
                    LeaseExpirationEmail = table.Column<bool>(type: "bit", nullable: false),
                    LeaseExpirationPhone = table.Column<bool>(type: "bit", nullable: false),
                    NewTenantNotificationsEmail = table.Column<bool>(type: "bit", nullable: false),
                    NewTenantNotificationsPhone = table.Column<bool>(type: "bit", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationSettings_UserId",
                table: "NotificationSettings",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationSettings");
        }
    }
}
