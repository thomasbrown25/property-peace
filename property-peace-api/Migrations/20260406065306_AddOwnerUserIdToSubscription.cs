using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerUserIdToSubscription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "OwnerUserId",
                schema: "subscription",
                table: "Subscriptions",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_OwnerUserId",
                schema: "subscription",
                table: "Subscriptions",
                column: "OwnerUserId",
                filter: "[OwnerUserId] IS NOT NULL");

            // Backfill: for existing landlord subscriptions, set OwnerUserId from
            // the organization's OwnerId. Tenant subscriptions (OrganizationId IS NULL) are left NULL.
            migrationBuilder.Sql(@"
                UPDATE s
                SET s.OwnerUserId = o.OwnerId
                FROM subscription.Subscriptions s
                INNER JOIN organization.Organizations o ON o.Id = s.OrganizationId
                WHERE s.OrganizationId IS NOT NULL
                  AND o.OwnerId IS NOT NULL
                  AND s.OwnerUserId IS NULL
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_OwnerUserId",
                schema: "subscription",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                schema: "subscription",
                table: "Subscriptions");
        }
    }
}
