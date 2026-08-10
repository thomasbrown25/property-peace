using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Milestone9AccountingHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BankStatementTransactions_MatchedLedgerEntryId",
                schema: "financial",
                table: "BankStatementTransactions");

            migrationBuilder.DropIndex(
                name: "IX_BankReconciliations_BankStatementId",
                schema: "financial",
                table: "BankReconciliations");

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementTransactions_MatchedLedgerEntryId",
                schema: "financial",
                table: "BankStatementTransactions",
                column: "MatchedLedgerEntryId",
                unique: true,
                filter: "[MatchedLedgerEntryId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BankReconciliations_BankStatementId",
                schema: "financial",
                table: "BankReconciliations",
                column: "BankStatementId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BankStatementTransactions_MatchedLedgerEntryId",
                schema: "financial",
                table: "BankStatementTransactions");

            migrationBuilder.DropIndex(
                name: "IX_BankReconciliations_BankStatementId",
                schema: "financial",
                table: "BankReconciliations");

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementTransactions_MatchedLedgerEntryId",
                schema: "financial",
                table: "BankStatementTransactions",
                column: "MatchedLedgerEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_BankReconciliations_BankStatementId",
                schema: "financial",
                table: "BankReconciliations",
                column: "BankStatementId");
        }
    }
}
