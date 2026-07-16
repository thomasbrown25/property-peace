using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class ConvertTenantLeaseToManyToMany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Create TenantLeases table
            migrationBuilder.CreateTable(
                name: "TenantLeases",
                columns: table => new
                {
                    TenantId = table.Column<long>(type: "bigint", nullable: false),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    TenantSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantLeases", x => new { x.TenantId, x.LeaseId });
                    table.ForeignKey(
                        name: "FK_TenantLeases_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TenantLeases_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantLeases_CreatedAt",
                table: "TenantLeases",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TenantLeases_LeaseId",
                table: "TenantLeases",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantLeases_TenantId",
                table: "TenantLeases",
                column: "TenantId");

            // Step 2: Migrate existing data from Tenants.LeaseId to TenantLeases
            migrationBuilder.Sql(@"
                INSERT INTO TenantLeases (TenantId, LeaseId, TenantSignedAt, CreatedAt)
                SELECT Id, LeaseId, TenantSignedAt, CreatedAt
                FROM Tenants
                WHERE LeaseId IS NOT NULL
            ");

            // Step 3: Drop foreign key and index
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_Leases_LeaseId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_LeaseId",
                table: "Tenants");

            // Step 4: Drop old columns
            migrationBuilder.DropColumn(
                name: "LeaseId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "TenantSignedAt",
                table: "Tenants");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantLeases");

            migrationBuilder.AddColumn<long>(
                name: "LeaseId",
                table: "Tenants",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TenantSignedAt",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_LeaseId",
                table: "Tenants",
                column: "LeaseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_Leases_LeaseId",
                table: "Tenants",
                column: "LeaseId",
                principalTable: "Leases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
