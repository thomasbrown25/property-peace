using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayPricingDiscounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayReservations_Quote",
                schema: "listing",
                table: "ShortStayReservations");

            migrationBuilder.AddColumn<long>(
                name: "DiscountCents",
                schema: "listing",
                table: "ShortStayReservations",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeekendNightlyRate",
                schema: "listing",
                table: "ShortStayListings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WeeklyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayReservations_Quote",
                schema: "listing",
                table: "ShortStayReservations",
                sql: "[GuestCount] > 0 AND [NightlySubtotalCents] > 0 AND [DiscountCents] >= 0 AND [CleaningFeeCents] >= 0 AND [TaxCents] >= 0 AND [TotalCents] = [NightlySubtotalCents] + [CleaningFeeCents] + [TaxCents] AND [TotalCents] <= 99999999 AND [Currency] = 'usd'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayListings_MonthlyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings",
                sql: "[MonthlyDiscountPercent] >= 0 AND [MonthlyDiscountPercent] <= 100");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayListings_WeekendNightlyRate",
                schema: "listing",
                table: "ShortStayListings",
                sql: "[WeekendNightlyRate] IS NULL OR ([WeekendNightlyRate] >= 0.01 AND [WeekendNightlyRate] <= 999999.99)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayListings_WeeklyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings",
                sql: "[WeeklyDiscountPercent] >= 0 AND [WeeklyDiscountPercent] <= 100");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayReservations_Quote",
                schema: "listing",
                table: "ShortStayReservations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayListings_MonthlyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayListings_WeekendNightlyRate",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayListings_WeeklyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "DiscountCents",
                schema: "listing",
                table: "ShortStayReservations");

            migrationBuilder.DropColumn(
                name: "MonthlyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "WeekendNightlyRate",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "WeeklyDiscountPercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayReservations_Quote",
                schema: "listing",
                table: "ShortStayReservations",
                sql: "[GuestCount] > 0 AND [NightlySubtotalCents] > 0 AND [CleaningFeeCents] >= 0 AND [TaxCents] >= 0 AND [TotalCents] = [NightlySubtotalCents] + [CleaningFeeCents] + [TaxCents] AND [TotalCents] <= 99999999 AND [Currency] = 'usd'");
        }
    }
}
