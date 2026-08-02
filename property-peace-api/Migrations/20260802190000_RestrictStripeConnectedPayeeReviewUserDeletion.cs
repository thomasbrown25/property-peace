using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(DataContext))]
    [Migration("20260802190000_RestrictStripeConnectedPayeeReviewUserDeletion")]
    public partial class RestrictStripeConnectedPayeeReviewUserDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StripeConnectedPayeeReviews_Users_UserId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews");

            migrationBuilder.AddForeignKey(
                name: "FK_StripeConnectedPayeeReviews_Users_UserId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                column: "UserId",
                principalSchema: "core",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StripeConnectedPayeeReviews_Users_UserId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews");

            migrationBuilder.AddForeignKey(
                name: "FK_StripeConnectedPayeeReviews_Users_UserId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                column: "UserId",
                principalSchema: "core",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
