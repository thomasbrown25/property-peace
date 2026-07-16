using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAllPremiumFeaturesOnFreePlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE Name = 'AllPremiumFeaturesOnFreePlan'
                    AND Object_ID = Object_ID('AdminSettings')
                )
                BEGIN
                    ALTER TABLE [AdminSettings] ADD [AllPremiumFeaturesOnFreePlan] bit NOT NULL DEFAULT CAST(0 AS bit)
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllPremiumFeaturesOnFreePlan",
                table: "AdminSettings");
        }
    }
}
