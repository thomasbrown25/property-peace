using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyUpdate6 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Files_FileCategories_CategoryId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Properties_PropertyId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Units_UnitId",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_FileCategories_CategoryId",
                table: "Files",
                column: "CategoryId",
                principalTable: "FileCategories",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Properties_PropertyId",
                table: "Files",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Units_UnitId",
                table: "Files",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Files_FileCategories_CategoryId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Properties_PropertyId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Units_UnitId",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_FileCategories_CategoryId",
                table: "Files",
                column: "CategoryId",
                principalTable: "FileCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Properties_PropertyId",
                table: "Files",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Units_UnitId",
                table: "Files",
                column: "UnitId",
                principalTable: "Units",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
