using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class FixTriagedToAcknowledgedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE maintenance.MaintenanceRequests SET Status = 'Acknowledged' WHERE Status = 'Triaged'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE maintenance.MaintenanceRequests SET Status = 'Triaged' WHERE Status = 'Acknowledged'");
        }
    }
}
