using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsPayableFieldsToExpense : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BillDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BillNumber",
                table: "Expenses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaid",
                table: "Expenses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidDate",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_IsPaid",
                table: "Expenses",
                column: "IsPaid");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_DueDate",
                table: "Expenses",
                column: "DueDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Expenses_DueDate",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_IsPaid",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "BillDate",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "BillNumber",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "IsPaid",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "PaidDate",
                table: "Expenses");
        }
    }
}
