using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchasedByUserToOrganizationSmsNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationSmsNumbers_PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers",
                column: "PurchasedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrganizationSmsNumbers_Users_PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers",
                column: "PurchasedByUserId",
                principalSchema: "core",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrganizationSmsNumbers_Users_PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers");

            migrationBuilder.DropIndex(
                name: "IX_OrganizationSmsNumbers_PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers");

            migrationBuilder.DropColumn(
                name: "PurchasedByUserId",
                schema: "messaging",
                table: "OrganizationSmsNumbers");
        }
    }
}
