using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAppleSignInIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppleId",
                schema: "core",
                table: "Users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_AppleId",
                schema: "core",
                table: "Users",
                column: "AppleId",
                unique: true,
                filter: "[AppleId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_AppleId",
                schema: "core",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AppleId",
                schema: "core",
                table: "Users");
        }
    }
}
