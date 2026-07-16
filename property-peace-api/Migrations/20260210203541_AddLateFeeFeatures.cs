using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLateFeeFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AppliedAfterDays",
                table: "LeaseFees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FeeType",
                table: "LeaseFees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLateFee",
                table: "LeaseFees",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LateFeeType",
                table: "LeaseFees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LimitAmount",
                table: "LeaseFees",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LimitAmountType",
                table: "LeaseFees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LimitDays",
                table: "LeaseFees",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LimitType",
                table: "LeaseFees",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PercentValue",
                table: "LeaseFees",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StartingAfterDays",
                table: "LeaseFees",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StateLateFeeLaws",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    State = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    GracePeriodDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FeeAmountDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUpdatedBy = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StateLateFeeLaws", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StateLateFeeLaws_LastUpdated",
                table: "StateLateFeeLaws",
                column: "LastUpdated");

            migrationBuilder.CreateIndex(
                name: "IX_StateLateFeeLaws_State",
                table: "StateLateFeeLaws",
                column: "State",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StateLateFeeLaws");

            migrationBuilder.DropColumn(
                name: "AppliedAfterDays",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "FeeType",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "IsLateFee",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "LateFeeType",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "LimitAmount",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "LimitAmountType",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "LimitDays",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "LimitType",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "PercentValue",
                table: "LeaseFees");

            migrationBuilder.DropColumn(
                name: "StartingAfterDays",
                table: "LeaseFees");
        }
    }
}
