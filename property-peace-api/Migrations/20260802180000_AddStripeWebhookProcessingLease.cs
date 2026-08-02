using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    [DbContext(typeof(DataContext))]
    [Migration("20260802180000_AddStripeWebhookProcessingLease")]
    public partial class AddStripeWebhookProcessingLease : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessingLeaseExpiresAt",
                table: "StripeWebhookEvents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProcessingLeaseId",
                table: "StripeWebhookEvents",
                type: "uniqueidentifier",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProcessingLeaseExpiresAt",
                table: "StripeWebhookEvents");

            migrationBuilder.DropColumn(
                name: "ProcessingLeaseId",
                table: "StripeWebhookEvents");
        }
    }
}
