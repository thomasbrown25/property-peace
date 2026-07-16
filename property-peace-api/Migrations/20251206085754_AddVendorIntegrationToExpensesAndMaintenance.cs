using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddVendorIntegrationToExpensesAndMaintenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_Vendors_VendorId",
                table: "MaintenanceRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_Vendors_VendorId",
                table: "MaintenanceRequests",
                column: "VendorId",
                principalTable: "Vendors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_Vendors_VendorId",
                table: "MaintenanceRequests");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_Vendors_VendorId",
                table: "MaintenanceRequests",
                column: "VendorId",
                principalTable: "Vendors",
                principalColumn: "Id");
        }
    }
}
