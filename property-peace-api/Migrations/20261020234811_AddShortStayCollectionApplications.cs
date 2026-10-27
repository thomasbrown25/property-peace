using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayCollectionApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShortStayCollectionApplications",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ApplicantUserId = table.Column<long>(type: "bigint", nullable: false),
                    StripeAccountId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false, defaultValue: "Draft"),
                    IdentityVerificationSessionId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IdentityVerifiedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ApprovedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    PropertyAuthorityConfirmedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SuspendedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SuspendedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    ApprovalCaseReference = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    AuthorityAttestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    FeePolicyConsentVersion = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayCollectionApplications", x => x.Id);
                    table.CheckConstraint("CK_ShortStayCollectionApplications_Status", "[Status] IN ('Draft', 'Submitted', 'IdentityPending', 'IdentityVerified', 'UnderReview', 'PayoutApproved', 'Suspended', 'Rejected')");
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplications_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplications_Users_ApplicantUserId",
                        column: x => x.ApplicantUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplications_Users_ApprovedByUserId",
                        column: x => x.ApprovedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplications_Users_SuspendedByUserId",
                        column: x => x.SuspendedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShortStayCollectionApplicationProperties",
                schema: "financial",
                columns: table => new
                {
                    ShortStayCollectionApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayCollectionApplicationProperties", x => new { x.ShortStayCollectionApplicationId, x.PropertyId });
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplicationProperties_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShortStayCollectionApplicationProperties_ShortStayCollectionApplications_ShortStayCollectionApplicationId",
                        column: x => x.ShortStayCollectionApplicationId,
                        principalSchema: "financial",
                        principalTable: "ShortStayCollectionApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplicationProperties_PropertyId",
                schema: "financial",
                table: "ShortStayCollectionApplicationProperties",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplications_ApplicantUserId",
                schema: "financial",
                table: "ShortStayCollectionApplications",
                column: "ApplicantUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplications_ApprovedByUserId",
                schema: "financial",
                table: "ShortStayCollectionApplications",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplications_IdentityVerificationSessionId",
                schema: "financial",
                table: "ShortStayCollectionApplications",
                column: "IdentityVerificationSessionId",
                unique: true,
                filter: "[IdentityVerificationSessionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplications_OrganizationId_ApplicantUserId",
                schema: "financial",
                table: "ShortStayCollectionApplications",
                columns: new[] { "OrganizationId", "ApplicantUserId" },
                unique: true,
                filter: "[Status] <> 'Rejected'");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayCollectionApplications_SuspendedByUserId",
                schema: "financial",
                table: "ShortStayCollectionApplications",
                column: "SuspendedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayCollectionApplicationProperties",
                schema: "financial");

            migrationBuilder.DropTable(
                name: "ShortStayCollectionApplications",
                schema: "financial");
        }
    }
}
