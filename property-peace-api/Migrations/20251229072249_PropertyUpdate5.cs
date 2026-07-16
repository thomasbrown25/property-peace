using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyUpdate5 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Organizations_OrganizationId",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Organizations_OrganizationId",
                table: "Files",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories");

            migrationBuilder.DropForeignKey(
                name: "FK_Files_Organizations_OrganizationId",
                table: "Files");

            migrationBuilder.AddForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Organizations_OrganizationId",
                table: "Files",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
