using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Refid2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceImages_MaintenanceRequests_MaintenanceRequestId",
                table: "MaintenanceImages");

            migrationBuilder.DropForeignKey(
                name: "FK_PropertyImages_Properties_PropertyId",
                table: "PropertyImages");

            migrationBuilder.DropIndex(
                name: "IX_PropertyImages_PropertyId",
                table: "PropertyImages");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceImages_MaintenanceRequestId",
                table: "MaintenanceImages");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "PropertyImages");

            migrationBuilder.DropColumn(
                name: "MaintenanceRequestId",
                table: "MaintenanceImages");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyImages_RefId",
                table: "PropertyImages",
                column: "RefId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceImages_RefId",
                table: "MaintenanceImages",
                column: "RefId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceImages_MaintenanceRequests_RefId",
                table: "MaintenanceImages",
                column: "RefId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PropertyImages_Properties_RefId",
                table: "PropertyImages",
                column: "RefId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaintenanceImages_MaintenanceRequests_RefId",
                table: "MaintenanceImages");

            migrationBuilder.DropForeignKey(
                name: "FK_PropertyImages_Properties_RefId",
                table: "PropertyImages");

            migrationBuilder.DropIndex(
                name: "IX_PropertyImages_RefId",
                table: "PropertyImages");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceImages_RefId",
                table: "MaintenanceImages");

            migrationBuilder.AddColumn<long>(
                name: "PropertyId",
                table: "PropertyImages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "MaintenanceRequestId",
                table: "MaintenanceImages",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateIndex(
                name: "IX_PropertyImages_PropertyId",
                table: "PropertyImages",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceImages_MaintenanceRequestId",
                table: "MaintenanceImages",
                column: "MaintenanceRequestId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaintenanceImages_MaintenanceRequests_MaintenanceRequestId",
                table: "MaintenanceImages",
                column: "MaintenanceRequestId",
                principalTable: "MaintenanceRequests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PropertyImages_Properties_PropertyId",
                table: "PropertyImages",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
