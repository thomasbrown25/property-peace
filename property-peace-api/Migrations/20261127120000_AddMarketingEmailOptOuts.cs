using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    [DbContext(typeof(DataContext))]
    [Migration("20261127120000_AddMarketingEmailOptOuts")]
    public partial class AddMarketingEmailOptOuts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MarketingEmailOptOuts",
                schema: "communication",
                columns: table => new
                {
                    EmailHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    UnsubscribedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MarketingEmailOptOuts", x => x.EmailHash);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MarketingEmailOptOuts",
                schema: "communication");
        }
    }
}
