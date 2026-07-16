using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class SubscriptionPaused : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PausedAt",
                table: "Subscriptions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PausedAtPeriodEnd",
                table: "Subscriptions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "BackgroundCheckCompletedAt",
                table: "RentalApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BackgroundCheckOverallPass",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckProvider",
                table: "RentalApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckRejectionReason",
                table: "RentalApplications",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckReportUrl",
                table: "RentalApplications",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckRequestId",
                table: "RentalApplications",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BackgroundCheckRequested",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BackgroundCheckRequestedAt",
                table: "RentalApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckStatus",
                table: "RentalApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckSummary",
                table: "RentalApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreditScore",
                table: "RentalApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedCreditCheck",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedCriminalCheck",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedEvictionCheck",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedIncomeVerification",
                table: "RentalApplications",
                type: "bit",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PausedAt",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "PausedAtPeriodEnd",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckCompletedAt",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckOverallPass",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckProvider",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRejectionReason",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckReportUrl",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequestId",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequested",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequestedAt",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckStatus",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckSummary",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "CreditScore",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedCreditCheck",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedCriminalCheck",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedEvictionCheck",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedIncomeVerification",
                table: "RentalApplications");
        }
    }
}
