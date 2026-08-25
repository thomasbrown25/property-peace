using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddRentPaymentAccessApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RentPaymentAccessRequests",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PublicId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    RequestedByUserId = table.Column<int>(type: "int", nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "int", nullable: true),
                    ReviewedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DecisionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    InternalNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StatusChangedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentPaymentAccessRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RentPaymentAccessAuditEvents",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RentPaymentAccessRequestId = table.Column<int>(type: "int", nullable: false),
                    OrganizationId = table.Column<int>(type: "int", nullable: false),
                    PriorStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    NextStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SafeMetadataJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentPaymentAccessAuditEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RentPaymentAccessAuditEvents_RentPaymentAccessRequests_RentPaymentAccessRequestId",
                        column: x => x.RentPaymentAccessRequestId,
                        principalSchema: "financial",
                        principalTable: "RentPaymentAccessRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RentPaymentAccessAuditEvents_OrganizationId_OccurredAtUtc",
                schema: "financial",
                table: "RentPaymentAccessAuditEvents",
                columns: new[] { "OrganizationId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_RentPaymentAccessAuditEvents_RentPaymentAccessRequestId_OccurredAtUtc",
                schema: "financial",
                table: "RentPaymentAccessAuditEvents",
                columns: new[] { "RentPaymentAccessRequestId", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_RentPaymentAccessRequests_OrganizationId",
                schema: "financial",
                table: "RentPaymentAccessRequests",
                column: "OrganizationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RentPaymentAccessRequests_PublicId",
                schema: "financial",
                table: "RentPaymentAccessRequests",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RentPaymentAccessAuditEvents",
                schema: "financial");

            migrationBuilder.DropTable(
                name: "RentPaymentAccessRequests",
                schema: "financial");
        }
    }
}
