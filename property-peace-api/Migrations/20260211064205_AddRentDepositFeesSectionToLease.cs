using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddRentDepositFeesSectionToLease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PetDepositAmount",
                schema: "lease",
                table: "Leases",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ProratedRentDue",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RentCollectionByPlatform",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RentCollectionOther",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RentCollectionOtherOptions",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RentCollectionOtherSpecify",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PetDepositAmount",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "ProratedRentDue",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentCollectionByPlatform",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentCollectionOther",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentCollectionOtherOptions",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentCollectionOtherSpecify",
                schema: "lease",
                table: "Leases");
        }
    }
}
