using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDurableCrudActivityEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ActivityType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Operation = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RelatedId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: true),
                    LeaseId = table.Column<long>(type: "bigint", nullable: true),
                    PerformedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    PerformedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityEvents", x => x.Id);
                    table.CheckConstraint("CK_ActivityEvents_Organization", "[OrganizationId] > 0");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_OrganizationId_ActivityType_RelatedId",
                table: "ActivityEvents",
                columns: new[] { "OrganizationId", "ActivityType", "RelatedId" });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityEvents_OrganizationId_CreatedAt_Id",
                table: "ActivityEvents",
                columns: new[] { "OrganizationId", "CreatedAt", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityEvents");
        }
    }
}
