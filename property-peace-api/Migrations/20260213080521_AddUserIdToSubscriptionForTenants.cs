using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserIdToSubscriptionForTenants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_OrganizationId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.AlterColumn<long>(
                name: "OrganizationId",
                schema: "subscription",
                table: "Subscriptions",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "UserId",
                schema: "subscription",
                table: "Subscriptions",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_OrganizationId",
                schema: "subscription",
                table: "Subscriptions",
                column: "OrganizationId",
                unique: true,
                filter: "[OrganizationId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_UserId",
                schema: "subscription",
                table: "Subscriptions",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Subscriptions_Users_UserId",
                schema: "subscription",
                table: "Subscriptions",
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
                name: "FK_Subscriptions_Users_UserId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_OrganizationId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_UserId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "UserId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.AlterColumn<long>(
                name: "OrganizationId",
                schema: "subscription",
                table: "Subscriptions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_OrganizationId",
                schema: "subscription",
                table: "Subscriptions",
                column: "OrganizationId",
                unique: true);
        }
    }
}
