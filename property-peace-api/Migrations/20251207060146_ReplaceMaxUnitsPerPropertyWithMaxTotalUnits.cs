using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceMaxUnitsPerPropertyWithMaxTotalUnits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "MaxUnitsPerProperty",
                table: "SubscriptionPlans",
                newName: "MaxTotalUnits");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "MaxTotalUnits",
                table: "SubscriptionPlans",
                newName: "MaxUnitsPerProperty");
        }
    }
}
