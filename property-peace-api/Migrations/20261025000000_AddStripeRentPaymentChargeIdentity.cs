using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    [DbContext(typeof(DataContext))]
    [Migration("20261025000000_AddStripeRentPaymentChargeIdentity")]
    public partial class AddStripeRentPaymentChargeIdentity : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChargeId",
                schema: "financial",
                table: "StripeRentPayments",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ChargeId",
                schema: "financial",
                table: "StripeRentPayments");
        }
    }
}
