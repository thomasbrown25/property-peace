using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadDeliveryLeases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LeadTokenDeliveries_Status_NextAttemptAtUtc_CreatedAtUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries");

            migrationBuilder.DropIndex(
                name: "IX_LeadNotificationIntents_Status_NotBeforeUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.AddColumn<Guid>(
                name: "LeaseId",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LeaseUntilUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttemptCount",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastError",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LeaseId",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LeaseUntilUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SentAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeadTokenDeliveries_Status_NextAttemptAtUtc_LeaseUntilUtc_CreatedAtUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                columns: new[] { "Status", "NextAttemptAtUtc", "LeaseUntilUtc", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_Status_NotBeforeUtc_NextAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                columns: new[] { "Status", "NotBeforeUtc", "NextAttemptAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LeadTokenDeliveries_Status_NextAttemptAtUtc_LeaseUntilUtc_CreatedAtUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries");

            migrationBuilder.DropIndex(
                name: "IX_LeadNotificationIntents_Status_NotBeforeUtc_NextAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "LeaseId",
                schema: "leasing",
                table: "LeadTokenDeliveries");

            migrationBuilder.DropColumn(
                name: "LeaseUntilUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries");

            migrationBuilder.DropColumn(
                name: "AttemptCount",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "LastAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "LastError",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "LeaseId",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "LeaseUntilUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "NextAttemptAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.DropColumn(
                name: "SentAtUtc",
                schema: "leasing",
                table: "LeadNotificationIntents");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTokenDeliveries_Status_NextAttemptAtUtc_CreatedAtUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                columns: new[] { "Status", "NextAttemptAtUtc", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_Status_NotBeforeUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                columns: new[] { "Status", "NotBeforeUtc" });
        }
    }
}
