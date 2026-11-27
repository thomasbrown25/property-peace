using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace brownstone_hub_api.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20261127123000_AddOnlinePaymentsSetupDismissal")]
public partial class AddOnlinePaymentsSetupDismissal : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "HasDismissedOnlinePaymentsSetup",
            schema: "organization",
            table: "OrganizationMembers",
            type: "bit",
            nullable: false,
            defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "HasDismissedOnlinePaymentsSetup",
            schema: "organization",
            table: "OrganizationMembers");
    }
}
