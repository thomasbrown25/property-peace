using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyUpdate7 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Files_Leases_LeaseId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Users_CreatedBy",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Users_UpdatedBy",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Leases_LeaseId",
                table: "Files",
                column: "LeaseId",
                principalTable: "Leases",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Users_CreatedBy",
                table: "Files",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Users_UpdatedBy",
                table: "Files",
                column: "UpdatedBy",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Files_Leases_LeaseId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Users_CreatedBy",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Users_UpdatedBy",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Leases_LeaseId",
                table: "Files",
                column: "LeaseId",
                principalTable: "Leases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Users_CreatedBy",
                table: "Files",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Users_UpdatedBy",
                table: "Files",
                column: "UpdatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
