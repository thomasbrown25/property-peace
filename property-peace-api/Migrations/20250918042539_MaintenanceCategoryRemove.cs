using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class MaintenanceCategoryRemove : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_MaintenanceCategories_CategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_CategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.AddColumn<long>(
                name: "MaintenanceCategoryId",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_MaintenanceCategoryId",
                table: "MaintenanceRequests",
                column: "MaintenanceCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_MaintenanceCategories_MaintenanceCategoryId",
                table: "MaintenanceRequests",
                column: "MaintenanceCategoryId",
                principalTable: "MaintenanceCategories",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceRequests_MaintenanceCategories_MaintenanceCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_MaintenanceCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "MaintenanceCategoryId",
                table: "MaintenanceRequests");

            migrationBuilder.AddColumn<long>(
                name: "CategoryId",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_CategoryId",
                table: "MaintenanceRequests",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceRequests_MaintenanceCategories_CategoryId",
                table: "MaintenanceRequests",
                column: "CategoryId",
                principalTable: "MaintenanceCategories",
                principalColumn: "Id");
        }
    }
}
