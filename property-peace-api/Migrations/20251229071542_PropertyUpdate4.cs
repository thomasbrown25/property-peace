using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyUpdate4 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories");

            migrationBuilder.AddForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories");

            migrationBuilder.AddForeignKey(
                name: "FK_FileCategories_Organizations_OrganizationId",
                table: "FileCategories",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
