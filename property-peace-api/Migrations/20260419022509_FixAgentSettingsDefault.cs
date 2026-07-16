using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class FixAgentSettingsDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE organization.Organizations SET IsCollectionsAgentEnabled = 1, IsMaintenanceAgentEnabled = 1");

            migrationBuilder.AlterColumn<bool>(
                name: "IsCollectionsAgentEnabled",
                schema: "organization",
                table: "Organizations",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<bool>(
                name: "IsMaintenanceAgentEnabled",
                schema: "organization",
                table: "Organizations",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldDefaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "IsCollectionsAgentEnabled",
                schema: "organization",
                table: "Organizations",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldDefaultValue: true);

            migrationBuilder.AlterColumn<bool>(
                name: "IsMaintenanceAgentEnabled",
                schema: "organization",
                table: "Organizations",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldDefaultValue: true);
        }
    }
}
