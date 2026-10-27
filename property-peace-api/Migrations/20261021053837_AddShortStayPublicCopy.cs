using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayPublicCopy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicSummary",
                schema: "listing",
                table: "ShortStayListings",
                type: "nvarchar(1200)",
                maxLength: 1200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicTitle",
                schema: "listing",
                table: "ShortStayListings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PublicSummary",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "PublicTitle",
                schema: "listing",
                table: "ShortStayListings");
        }
    }
}
