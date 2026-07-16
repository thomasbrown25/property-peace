using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOperatingAccountIdToLease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "OperatingAccountId",
                schema: "lease",
                table: "Leases",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Leases_OperatingAccountId",
                schema: "lease",
                table: "Leases",
                column: "OperatingAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Leases_BankAccounts_OperatingAccountId",
                schema: "lease",
                table: "Leases",
                column: "OperatingAccountId",
                principalSchema: "financial",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Leases_BankAccounts_OperatingAccountId",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropIndex(
                name: "IX_Leases_OperatingAccountId",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "OperatingAccountId",
                schema: "lease",
                table: "Leases");
        }
    }
}
