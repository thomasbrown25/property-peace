using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddPeopleOnLeaseTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AddTenantsLater",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "TenantMailingAddressDiffers",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TenantMailingCity",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantMailingState",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantMailingStreetAddress",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantMailingUnit",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantMailingZipCode",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeaseAdditionalSigners",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseAdditionalSigners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseAdditionalSigners_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeaseCoSigners",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseCoSigners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseCoSigners_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeaseLandlords",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CompanyName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    StreetAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    City = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ZipCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseLandlords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseLandlords_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseAdditionalSigners_LeaseId",
                schema: "lease",
                table: "LeaseAdditionalSigners",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseCoSigners_LeaseId",
                schema: "lease",
                table: "LeaseCoSigners",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseLandlords_LeaseId",
                schema: "lease",
                table: "LeaseLandlords",
                column: "LeaseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseAdditionalSigners",
                schema: "lease");

            migrationBuilder.DropTable(
                name: "LeaseCoSigners",
                schema: "lease");

            migrationBuilder.DropTable(
                name: "LeaseLandlords",
                schema: "lease");

            migrationBuilder.DropColumn(
                name: "AddTenantsLater",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingAddressDiffers",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingCity",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingState",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingStreetAddress",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingUnit",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "TenantMailingZipCode",
                schema: "lease",
                table: "Leases");
        }
    }
}
