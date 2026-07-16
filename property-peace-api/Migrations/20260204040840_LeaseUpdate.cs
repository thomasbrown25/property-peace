using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class LeaseUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RentIncreaseInterval",
                table: "Leases",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RentIncreaseType",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RentIncreaseValue",
                table: "Leases",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RentIncreaseInterval",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentIncreaseType",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentIncreaseValue",
                table: "Leases");
        }
    }
}
