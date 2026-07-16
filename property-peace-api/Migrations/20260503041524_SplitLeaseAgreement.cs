using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class SplitLeaseAgreement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Create the new LeaseAgreements table
            migrationBuilder.CreateTable(
                name: "LeaseAgreements",
                schema: "lease",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    IsDrafted = table.Column<bool>(type: "bit", nullable: true),
                    IsLeaseSpecificsComplete = table.Column<bool>(type: "bit", nullable: false),
                    IsRentDepositFeesComplete = table.Column<bool>(type: "bit", nullable: false),
                    IsPeopleOnLeaseComplete = table.Column<bool>(type: "bit", nullable: false),
                    IsPetsSmokingOtherComplete = table.Column<bool>(type: "bit", nullable: false),
                    IsUtilitiesMaintenanceKeysComplete = table.Column<bool>(type: "bit", nullable: false),
                    IsProvisionsAttachmentsComplete = table.Column<bool>(type: "bit", nullable: false),
                    SignatureStatus = table.Column<int>(type: "int", nullable: true),
                    DocuSignEnvelopeId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SignatureSentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SignatureCompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SignatureExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LandlordSignature = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LandlordSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LandlordSignedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SignedDocumentBlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SignedDocumentBlobUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseAgreements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseAgreements_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseAgreements_LeaseId",
                schema: "lease",
                table: "LeaseAgreements",
                column: "LeaseId",
                unique: true);

            // Step 2: Copy existing data from Leases into LeaseAgreements (one row per lease)
            migrationBuilder.Sql(@"
                INSERT INTO [lease].[LeaseAgreements]
                (
                    LeaseId, IsDrafted,
                    IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                    IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete,
                    IsUtilitiesMaintenanceKeysComplete, IsProvisionsAttachmentsComplete,
                    SignatureStatus, DocuSignEnvelopeId,
                    SignatureSentAt, SignatureCompletedAt, SignatureExpiresAt,
                    LandlordSignature, LandlordSignedAt, LandlordSignedBy,
                    SignedDocumentBlobName, SignedDocumentBlobUrl
                )
                SELECT
                    Id, IsDrafted,
                    IsLeaseSpecificsComplete, IsRentDepositFeesComplete,
                    IsPeopleOnLeaseComplete, IsPetsSmokingOtherComplete,
                    IsUtilitiesMaintenanceKeysComplete, IsProvisionsAttachmentsComplete,
                    SignatureStatus, DocuSignEnvelopeId,
                    SignatureSentAt, SignatureCompletedAt, SignatureExpiresAt,
                    LandlordSignature, LandlordSignedAt, LandlordSignedBy,
                    SignedDocumentBlobName, SignedDocumentBlobUrl
                FROM [lease].[Leases]
                WHERE IsDeleted = 0 OR IsDeleted IS NULL;
            ");

            // Step 3: Drop the moved columns from Leases
            migrationBuilder.DropColumn(name: "DocuSignEnvelopeId",             schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsDrafted",                       schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsLeaseSpecificsComplete",        schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsPeopleOnLeaseComplete",         schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsPetsSmokingOtherComplete",      schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsProvisionsAttachmentsComplete", schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsRentDepositFeesComplete",       schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "IsUtilitiesMaintenanceKeysComplete", schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "LandlordSignature",               schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "LandlordSignedAt",                schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "LandlordSignedBy",                schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignatureCompletedAt",            schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignatureExpiresAt",              schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignatureSentAt",                 schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignatureStatus",                 schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignedDocumentBlobName",          schema: "lease", table: "Leases");
            migrationBuilder.DropColumn(name: "SignedDocumentBlobUrl",           schema: "lease", table: "Leases");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<string>(
                name: "DocuSignEnvelopeId",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDrafted",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLeaseSpecificsComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPeopleOnLeaseComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPetsSmokingOtherComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsProvisionsAttachmentsComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRentDepositFeesComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsUtilitiesMaintenanceKeysComplete",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LandlordSignature",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LandlordSignedAt",
                schema: "lease",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LandlordSignedBy",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureCompletedAt",
                schema: "lease",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureExpiresAt",
                schema: "lease",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureSentAt",
                schema: "lease",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SignatureStatus",
                schema: "lease",
                table: "Leases",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignedDocumentBlobName",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignedDocumentBlobUrl",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            // Copy data back from LeaseAgreements to Leases before dropping the table
            migrationBuilder.Sql(@"
                UPDATE l SET
                    l.IsDrafted = la.IsDrafted,
                    l.IsLeaseSpecificsComplete = la.IsLeaseSpecificsComplete,
                    l.IsRentDepositFeesComplete = la.IsRentDepositFeesComplete,
                    l.IsPeopleOnLeaseComplete = la.IsPeopleOnLeaseComplete,
                    l.IsPetsSmokingOtherComplete = la.IsPetsSmokingOtherComplete,
                    l.IsUtilitiesMaintenanceKeysComplete = la.IsUtilitiesMaintenanceKeysComplete,
                    l.IsProvisionsAttachmentsComplete = la.IsProvisionsAttachmentsComplete,
                    l.SignatureStatus = la.SignatureStatus,
                    l.DocuSignEnvelopeId = la.DocuSignEnvelopeId,
                    l.SignatureSentAt = la.SignatureSentAt,
                    l.SignatureCompletedAt = la.SignatureCompletedAt,
                    l.SignatureExpiresAt = la.SignatureExpiresAt,
                    l.LandlordSignature = la.LandlordSignature,
                    l.LandlordSignedAt = la.LandlordSignedAt,
                    l.LandlordSignedBy = la.LandlordSignedBy,
                    l.SignedDocumentBlobName = la.SignedDocumentBlobName,
                    l.SignedDocumentBlobUrl = la.SignedDocumentBlobUrl
                FROM [lease].[Leases] l
                INNER JOIN [lease].[LeaseAgreements] la ON la.LeaseId = l.Id;
            ");

            migrationBuilder.DropTable(name: "LeaseAgreements", schema: "lease");
        }
    }
}
