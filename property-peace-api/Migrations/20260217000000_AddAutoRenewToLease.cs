using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAutoRenewToLease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoRenewLease",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "AutoRenewRentIncrement",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AutoRenewRentIncrementType",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AutoRenewRentIncrementValue",
                schema: "lease",
                table: "Leases",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoRenewLease",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "AutoRenewRentIncrement",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "AutoRenewRentIncrementType",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "AutoRenewRentIncrementValue",
                schema: "lease",
                table: "Leases");
        }
    }
}
