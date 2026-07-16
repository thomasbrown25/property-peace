using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseAgreementStepCompletionStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLeaseSpecificsComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPeopleOnLeaseComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPetsSmokingOtherComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsProvisionsAttachmentsComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRentDepositFeesComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsUtilitiesMaintenanceKeysComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsLeaseSpecificsComplete",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IsPeopleOnLeaseComplete",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IsPetsSmokingOtherComplete",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IsProvisionsAttachmentsComplete",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IsRentDepositFeesComplete",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IsUtilitiesMaintenanceKeysComplete",
                schema: "lease",
                table: "Leases");
        }
    }
}
