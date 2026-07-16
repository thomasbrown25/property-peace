using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseESignatureFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DocuSignEnvelopeId",
                table: "Leases",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LandlordSignature",
                table: "Leases",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LandlordSignedAt",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LandlordSignedBy",
                table: "Leases",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LeaseTemplateId",
                table: "Leases",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureCompletedAt",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureExpiresAt",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignatureSentAt",
                table: "Leases",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SignatureStatus",
                table: "Leases",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SignedDocumentBlobName",
                table: "Leases",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignedDocumentBlobUrl",
                table: "Leases",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DocuSignEnvelopeId",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LandlordSignature",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LandlordSignedAt",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LandlordSignedBy",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LeaseTemplateId",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignatureCompletedAt",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignatureExpiresAt",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignatureSentAt",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignatureStatus",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignedDocumentBlobName",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "SignedDocumentBlobUrl",
                table: "Leases");
        }
    }
}
