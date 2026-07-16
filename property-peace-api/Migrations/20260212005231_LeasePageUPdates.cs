using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class LeasePageUPdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasSharedUtilities",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceNotificationMethods",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SharedUtilitiesDisclosure",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeaseKeys",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    KeyType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Copies = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseKeys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseKeys_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeaseKeys_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceResponsibility",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Responsibility = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceResponsibility", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceResponsibility_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaintenanceResponsibility_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UtilityServiceResponsibility",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Responsibility = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UtilityServiceResponsibility", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UtilityServiceResponsibility_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UtilityServiceResponsibility_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseKeys_LeaseId",
                schema: "lease",
                table: "LeaseKeys",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseKeys_OrganizationId",
                schema: "lease",
                table: "LeaseKeys",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceResponsibility_LeaseId",
                schema: "lease",
                table: "MaintenanceResponsibility",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceResponsibility_OrganizationId",
                schema: "lease",
                table: "MaintenanceResponsibility",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_UtilityServiceResponsibility_LeaseId",
                schema: "lease",
                table: "UtilityServiceResponsibility",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_UtilityServiceResponsibility_OrganizationId",
                schema: "lease",
                table: "UtilityServiceResponsibility",
                column: "OrganizationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseKeys",
                schema: "lease");

            migrationBuilder.DropTable(
                name: "MaintenanceResponsibility",
                schema: "lease");

            migrationBuilder.DropTable(
                name: "UtilityServiceResponsibility",
                schema: "lease");

            migrationBuilder.DropColumn(
                name: "HasSharedUtilities",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "MaintenanceNotificationMethods",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SharedUtilitiesDisclosure",
                schema: "lease",
                table: "Leases");
        }
    }
}
