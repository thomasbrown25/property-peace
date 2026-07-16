using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class CreateTaxCategoryTableAndAddL : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "DepositId1",
                table: "Payments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLoanPayment",
                table: "Expenses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanInterestAmount",
                table: "Expenses",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanPrincipalAmount",
                table: "Expenses",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoanProvider",
                table: "Expenses",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TaxCategoryId",
                table: "Expenses",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TaxCategories",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScheduleELineNumber = table.Column<int>(type: "int", nullable: true),
                    IsFullyDeductible = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    EnumValue = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxCategories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_DepositId1",
                table: "Payments",
                column: "DepositId1");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_TaxCategoryId",
                table: "Expenses",
                column: "TaxCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxCategories_Name",
                table: "TaxCategories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaxCategories_ScheduleELineNumber",
                table: "TaxCategories",
                column: "ScheduleELineNumber");

            migrationBuilder.CreateIndex(
                name: "IX_TaxCategories_SortOrder",
                table: "TaxCategories",
                column: "SortOrder");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_TaxCategories_TaxCategoryId",
                table: "Expenses",
                column: "TaxCategoryId",
                principalTable: "TaxCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Deposits_DepositId1",
                table: "Payments",
                column: "DepositId1",
                principalTable: "Deposits",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_TaxCategories_TaxCategoryId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Deposits_DepositId1",
                table: "Payments");

            migrationBuilder.DropTable(
                name: "TaxCategories");

            migrationBuilder.DropIndex(
                name: "IX_Payments_DepositId1",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_TaxCategoryId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "DepositId1",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "IsLoanPayment",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "LoanInterestAmount",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "LoanPrincipalAmount",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "LoanProvider",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "TaxCategoryId",
                table: "Expenses");
        }
    }
}
