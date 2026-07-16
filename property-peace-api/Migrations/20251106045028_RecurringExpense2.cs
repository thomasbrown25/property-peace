using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class RecurringExpense2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Expenses");

            migrationBuilder.AddColumn<int>(
                name: "DayOfPeriod",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Frequency",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "Expenses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastGeneratedDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Expenses",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "NextOccurrenceDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DayOfPeriod",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "LastGeneratedDate",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "NextOccurrenceDate",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "Expenses");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Expenses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
