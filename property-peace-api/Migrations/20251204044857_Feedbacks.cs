using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Feedbacks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFavorite",
                table: "SupportAndFeedbacks",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_SupportAndFeedbacks_IsFavorite",
                table: "SupportAndFeedbacks",
                column: "IsFavorite");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SupportAndFeedbacks_IsFavorite",
                table: "SupportAndFeedbacks");

            migrationBuilder.DropColumn(
                name: "IsFavorite",
                table: "SupportAndFeedbacks");
        }
    }
}
