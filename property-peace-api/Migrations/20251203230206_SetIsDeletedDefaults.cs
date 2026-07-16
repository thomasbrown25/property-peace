using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class SetIsDeletedDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Set default value for IsDeleted on Properties
            migrationBuilder.AlterColumn<bool>(
                name: "IsDeleted",
                table: "Properties",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Set default value for IsDeleted on Leases
            migrationBuilder.AlterColumn<bool>(
                name: "IsDeleted",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Update any existing records that might have IsDeleted = true to false
            // (in case the rename from IsActive caused issues)
            migrationBuilder.Sql("UPDATE Properties SET IsDeleted = 0 WHERE IsDeleted = 1");
            migrationBuilder.Sql("UPDATE Leases SET IsDeleted = 0 WHERE IsDeleted = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
