using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddRentDirectChargeAccountProvenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChargeStripeAccountId",
                schema: "financial",
                table: "StripeRentPayments",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StripeRentCustomers",
                schema: "financial",
                columns: table => new
                {
                    TenantUserId = table.Column<long>(type: "bigint", nullable: false),
                    StripeAccountId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CustomerId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeRentCustomers", x => new { x.TenantUserId, x.StripeAccountId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentCustomers_StripeAccountId_CustomerId",
                schema: "financial",
                table: "StripeRentCustomers",
                columns: new[] { "StripeAccountId", "CustomerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeRentCustomers",
                schema: "financial");

            migrationBuilder.DropColumn(
                name: "ChargeStripeAccountId",
                schema: "financial",
                table: "StripeRentPayments");
        }
    }
}
