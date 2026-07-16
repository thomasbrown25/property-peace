using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class RenameLeaseShieldLandlordIdToUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Conversations_Users_LandlordId",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_LandlordId",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_LandlordId_UpdatedAt",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.RenameColumn(
                name: "LandlordId",
                table: "Conversations",
                newName: "UserId",
                schema: "lease_shield");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_UserId",
                table: "Conversations",
                schema: "lease_shield",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_UserId_UpdatedAt",
                table: "Conversations",
                schema: "lease_shield",
                columns: new[] { "UserId", "UpdatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Conversations_Users_UserId",
                table: "Conversations",
                schema: "lease_shield",
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
                name: "FK_Conversations_Users_UserId",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_UserId",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.DropIndex(
                name: "IX_Conversations_UserId_UpdatedAt",
                table: "Conversations",
                schema: "lease_shield");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Conversations",
                newName: "LandlordId",
                schema: "lease_shield");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_LandlordId",
                table: "Conversations",
                schema: "lease_shield",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_LandlordId_UpdatedAt",
                table: "Conversations",
                schema: "lease_shield",
                columns: new[] { "LandlordId", "UpdatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Conversations_Users_LandlordId",
                table: "Conversations",
                schema: "lease_shield",
                column: "LandlordId",
                principalSchema: "core",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
