using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class LeaseUpdatePets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PetsAllowed",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SmokingAllowed",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Parking",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    IncludeParkingRules = table.Column<bool>(type: "bit", nullable: false),
                    ParkingTypes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CustomRules = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parking", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Parking_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Parking_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Pets",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    Type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Breed = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Weight = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Age = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pets_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Pets_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Parking_LeaseId",
                schema: "lease",
                table: "Parking",
                column: "LeaseId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parking_OrganizationId",
                schema: "lease",
                table: "Parking",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Pets_LeaseId",
                schema: "lease",
                table: "Pets",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Pets_OrganizationId",
                schema: "lease",
                table: "Pets",
                column: "OrganizationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Parking",
                schema: "lease");

            migrationBuilder.DropTable(
                name: "Pets",
                schema: "lease");

            migrationBuilder.DropColumn(
                name: "PetsAllowed",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SmokingAllowed",
                schema: "lease",
                table: "Leases");
        }
    }
}
