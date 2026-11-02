using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20261028000000_AddShortStayBookingAcceptancePreference")]
public sealed class AddShortStayBookingAcceptancePreference : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "BookingAcceptancePreference",
            schema: "listing",
            table: "ShortStayListings",
            type: "nvarchar(48)",
            maxLength: 48,
            nullable: false,
            defaultValue: "RequireOwnerApproval");
        migrationBuilder.AddCheckConstraint(
            name: "CK_ShortStayListings_BookingAcceptancePreference",
            schema: "listing",
            table: "ShortStayListings",
            sql: "[BookingAcceptancePreference] IN ('RequireOwnerApproval', 'AutoConfirmAfterVerifiedPayment')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_ShortStayListings_BookingAcceptancePreference",
            schema: "listing",
            table: "ShortStayListings");
        migrationBuilder.DropColumn(
            name: "BookingAcceptancePreference",
            schema: "listing",
            table: "ShortStayListings");
    }
}
