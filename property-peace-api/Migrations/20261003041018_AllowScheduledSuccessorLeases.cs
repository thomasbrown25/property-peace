using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AllowScheduledSuccessorLeases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Leases_UnitId",
                schema: "lease",
                table: "Leases");

            migrationBuilder.CreateIndex(
                name: "IX_Leases_UnitId",
                schema: "lease",
                table: "Leases",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Leases_UnitId",
                schema: "lease",
                table: "Leases");

            migrationBuilder.CreateIndex(
                name: "IX_Leases_UnitId",
                schema: "lease",
                table: "Leases",
                column: "UnitId",
                unique: true);
        }
    }
}
