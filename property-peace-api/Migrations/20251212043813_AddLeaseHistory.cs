using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "LeaseHistories",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OriginalLeaseId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DepositAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LeaseLength = table.Column<int>(type: "int", nullable: false),
                    RentFrequency = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RentDueDay = table.Column<int>(type: "int", nullable: false),
                    OverdueAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CustomDateSelected = table.Column<bool>(type: "bit", nullable: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SignatureStatus = table.Column<int>(type: "int", nullable: false),
                    DocuSignEnvelopeId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SignatureSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SignatureCompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SignatureExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LandlordSignature = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LandlordSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LandlordSignedBy = table.Column<long>(type: "bigint", nullable: true),
                    SignedDocumentBlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SignedDocumentBlobUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LeaseTemplateId = table.Column<long>(type: "bigint", nullable: true),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseHistories_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseHistories_ArchivedAt",
                table: "LeaseHistories",
                column: "ArchivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseHistories_OrganizationId",
                table: "LeaseHistories",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseHistories_OriginalLeaseId",
                table: "LeaseHistories",
                column: "OriginalLeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseHistories_UnitId",
                table: "LeaseHistories",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseHistories");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Leases");
        }
    }
}
