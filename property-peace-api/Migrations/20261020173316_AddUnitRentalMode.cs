using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddUnitRentalMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RentalMode",
                schema: "property",
                table: "Units",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "LongTerm");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Units_RentalMode",
                schema: "property",
                table: "Units",
                sql: "[RentalMode] IN ('LongTerm', 'ShortTerm')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Units_RentalMode",
                schema: "property",
                table: "Units");

            migrationBuilder.DropColumn(
                name: "RentalMode",
                schema: "property",
                table: "Units");
        }
    }
}
