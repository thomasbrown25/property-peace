using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using brownstone_hub_api.Data;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(DataContext))]
    [Migration("20260617085338_AddNotificationPreferencesConfiguredToUsers")]
    public partial class AddNotificationPreferencesConfiguredToUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('core.Users', 'NotificationPreferencesConfigured') IS NULL
BEGIN
    ALTER TABLE [core].[Users]
    ADD [NotificationPreferencesConfigured] bit NOT NULL CONSTRAINT [DF_Users_NotificationPreferencesConfigured] DEFAULT CAST(0 AS bit);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificationPreferencesConfigured",
                schema: "core",
                table: "Users");
        }
    }
}
