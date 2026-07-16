using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AllowNullSuppressedUntil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Alter the SuppressedUntil column to allow nulls
            migrationBuilder.AlterColumn<DateTime>(
                name: "SuppressedUntil",
                table: "ActionSuppressions",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert the SuppressedUntil column to not allow nulls
            // Note: This will fail if there are existing null values
            migrationBuilder.AlterColumn<DateTime>(
                name: "SuppressedUntil",
                table: "ActionSuppressions",
                type: "datetime2",
                nullable: false,
                defaultValue: DateTime.UtcNow,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);
        }
    }
}
