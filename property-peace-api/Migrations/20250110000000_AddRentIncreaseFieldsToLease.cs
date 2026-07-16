using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddRentIncreaseFieldsToLease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RentIncreaseType",
                table: "Leases",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RentIncreaseValue",
                table: "Leases",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RentIncreaseInterval",
                table: "Leases",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RentIncreaseType",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentIncreaseValue",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "RentIncreaseInterval",
                table: "Leases");
        }
    }
}
