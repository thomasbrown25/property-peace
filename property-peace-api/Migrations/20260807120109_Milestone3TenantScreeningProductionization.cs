using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Milestone3TenantScreeningProductionization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // BackgroundCheckCompletedAt is an unrelated legacy column. It is intentionally left
            // in place and tolerated by the EF model so this screening migration is non-destructive.

            migrationBuilder.DropColumn(
                name: "BackgroundCheckOverallPass",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckProvider",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRejectionReason",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckReportUrl",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequestId",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequested",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckRequestedAt",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckStatus",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "BackgroundCheckSummary",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "CreditScore",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedCreditCheck",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedCriminalCheck",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedEvictionCheck",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PassedIncomeVerification",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "Ssn",
                schema: "tenant",
                table: "RentalApplications");

            migrationBuilder.EnsureSchema(
                name: "screening");

            migrationBuilder.CreateTable(
                name: "ScreeningSupportElevations",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    SubjectUserId = table.Column<long>(type: "bigint", nullable: false),
                    ApprovedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    CaseReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RevokedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    RevokedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    MaximumAccessCount = table.Column<int>(type: "int", nullable: false),
                    AccessCount = table.Column<int>(type: "int", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningSupportElevations", x => x.Id);
                    table.CheckConstraint("CK_ScreeningSupportElevations_Approver", "[ApprovedByUserId] <> [SubjectUserId]");
                    table.CheckConstraint("CK_ScreeningSupportElevations_Count", "[MaximumAccessCount] > 0 AND [AccessCount] >= 0 AND [AccessCount] <= [MaximumAccessCount]");
                    table.CheckConstraint("CK_ScreeningSupportElevations_Lifetime", "[ExpiresAt] > [IssuedAt]");
                    table.ForeignKey(
                        name: "FK_ScreeningSupportElevations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningSupportElevations_Users_ApprovedByUserId",
                        column: x => x.ApprovedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningSupportElevations_Users_RevokedByUserId",
                        column: x => x.RevokedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningSupportElevations_Users_SubjectUserId",
                        column: x => x.SubjectUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TenantScreeningOrders",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    ListingId = table.Column<long>(type: "bigint", nullable: true),
                    ApplicantAccessTokenHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: true),
                    ApplicantAccessExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    InvitationIdempotencyKeyHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CurrentRevision = table.Column<long>(type: "bigint", nullable: false),
                    PackageCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    JurisdictionCode = table.Column<string>(type: "char(2)", unicode: false, maxLength: 2, nullable: false),
                    Payer = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    QuoteReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LandlordAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    ApplicantAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    ProviderAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    PlatformFeeMinor = table.Column<long>(type: "bigint", nullable: false),
                    TaxAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    TotalAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "char(3)", unicode: false, maxLength: 3, nullable: false),
                    QuoteExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    QuotePolicyVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderOrderId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RequesterUserId = table.Column<long>(type: "bigint", nullable: false),
                    RequesterMemberId = table.Column<long>(type: "bigint", nullable: false),
                    RequesterMemberRole = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RequesterPermissionSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RequesterAuthorityVerifiedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    PermissiblePurposeStatement = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    PermissiblePurposeVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DisclosureStatement = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    DisclosureVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AuthorizationStatement = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    AuthorizationVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RentalCriteriaStatement = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    RentalCriteriaVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PricingPolicyVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AllowedChecksJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    MaximumApplicantTotalMinor = table.Column<long>(type: "bigint", nullable: true),
                    ApplicantTotalExpresslyUnrestricted = table.Column<bool>(type: "bit", nullable: false),
                    MaximumPlatformFeeMinor = table.Column<long>(type: "bigint", nullable: false),
                    MarkupPermitted = table.Column<bool>(type: "bit", nullable: false),
                    MinimumQuoteLifetimeSeconds = table.Column<long>(type: "bigint", nullable: false),
                    MaximumQuoteLifetimeSeconds = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ExpiredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantScreeningOrders", x => x.Id);
                    table.CheckConstraint("CK_TenantScreeningOrders_QuoteAmounts", "[LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]");
                    table.CheckConstraint("CK_TenantScreeningOrders_Revision", "[CurrentRevision] >= 0");
                    table.ForeignKey(
                        name: "FK_TenantScreeningOrders_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantScreeningOrders_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantScreeningOrders_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantScreeningOrders_Users_RequesterUserId",
                        column: x => x.RequesterUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningCancellationIntents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    ExpectedOrderRevision = table.Column<long>(type: "bigint", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderOrderId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReasonCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntil = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ProviderAcceptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ProviderReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningCancellationIntents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningCancellationIntents_Attempts", "[Attempts] >= 0");
                    table.ForeignKey(
                        name: "FK_ScreeningCancellationIntents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningCancellationIntents_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningCancellationIntents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningCancellationIntents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningConsentEvidence",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    DisclosureVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AuthorizationVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ConsentedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ActorType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    IpAddressHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    UserAgentHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    QuoteReferenceHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    ProviderAuthorizationReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningConsentEvidence", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScreeningConsentEvidence_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningConsentEvidence_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningIncidents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: true),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProviderEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IncidentType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DetectedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ContainedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    AffectedResourceSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    DetectionSource = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FailureEvidenceReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RemediationEvidenceReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    NotificationEvidenceReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningIncidents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningIncidents_Resolution", "[ResolvedAt] IS NULL OR [ContainedAt] IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_ScreeningIncidents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningIncidents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningIncidents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningPaymentEvidence",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Payer = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    LandlordAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    ApplicantAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    ProviderAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    PlatformFeeMinor = table.Column<long>(type: "bigint", nullable: false),
                    TaxAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    TotalAmountMinor = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "char(3)", unicode: false, maxLength: 3, nullable: false),
                    QuoteReferenceHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    PaymentOperationReferenceHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    ProviderOccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningPaymentEvidence", x => x.Id);
                    table.CheckConstraint("CK_ScreeningPaymentEvidence_Amounts", "[LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]");
                    table.CheckConstraint("CK_ScreeningPaymentEvidence_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningPaymentEvidence_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningPaymentEvidence_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningPaymentEvidence_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningReportRevisions",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderReportReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ProviderOccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    CorrectedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ReportVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NormalizedFactsJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    NormalizedFactsSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    SupersedesScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: true),
                    RetentionExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RetentionSignal = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DeleteRequestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    DeletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    IsUnderLegalHold = table.Column<bool>(type: "bit", nullable: false),
                    LegalHoldPlacedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    LegalHoldReleasedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    LegalHoldReasonCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeletionClaimToken = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DeletionClaimedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    DeletionClaimExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    DeletionProviderCallStartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    PendingDisputeOperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningReportRevisions", x => x.Id);
                    table.CheckConstraint("CK_ScreeningReportRevisions_Deletion", "[DeletedAt] IS NULL OR [DeleteRequestedAt] IS NOT NULL");
                    table.CheckConstraint("CK_ScreeningReportRevisions_NormalizedFactsJson", "ISJSON([NormalizedFactsJson]) = 1");
                    table.CheckConstraint("CK_ScreeningReportRevisions_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningReportRevisions_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportRevisions_ScreeningReportRevisions_SupersedesScreeningReportRevisionId",
                        column: x => x.SupersedesScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportRevisions_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningDisputeIntents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                    OperationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    ScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderOrderId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProviderReportReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ActorType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    IssueCodesJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    NotesSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    RetentionExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntil = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ProviderAcceptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ProviderReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningDisputeIntents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningDisputeIntents_Attempts", "[Attempts] >= 0");
                    table.CheckConstraint("CK_ScreeningDisputeIntents_IssueCodesJson", "ISJSON([IssueCodesJson]) = 1");
                    table.ForeignKey(name: "FK_ScreeningDisputeIntents_Organizations_OrganizationId", column: x => x.OrganizationId, principalSchema: "organization", principalTable: "Organizations", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_ScreeningDisputeIntents_RentalApplications_RentalApplicationId", column: x => x.RentalApplicationId, principalSchema: "tenant", principalTable: "RentalApplications", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_ScreeningDisputeIntents_ScreeningReportRevisions_ScreeningReportRevisionId", column: x => x.ScreeningReportRevisionId, principalSchema: "screening", principalTable: "ScreeningReportRevisions", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_ScreeningDisputeIntents_TenantScreeningOrders_TenantScreeningOrderId", column: x => x.TenantScreeningOrderId, principalSchema: "screening", principalTable: "TenantScreeningOrders", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "FK_ScreeningDisputeIntents_Users_ActorUserId", column: x => x.ActorUserId, principalSchema: "core", principalTable: "Users", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningTransitionEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ToStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ReasonCode = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProviderEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningTransitionEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningTransitionEvents_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningTransitionEvents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningTransitionEvents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningTransitionEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningWebhookInboxEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PayloadSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    SignedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    AuthenticationScheme = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AuthenticationKeyVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderSequence = table.Column<long>(type: "bigint", nullable: true),
                    ProviderOrderId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CanonicalStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    NormalizedReasonCode = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PaymentQuoteReferenceHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: true),
                    PaymentOperationReferenceHash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: true),
                    PaymentPayer = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    PaymentLandlordAmountMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentApplicantAmountMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentProviderAmountMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentPlatformFeeMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentTaxAmountMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentTotalAmountMinor = table.Column<long>(type: "bigint", nullable: true),
                    PaymentCurrency = table.Column<string>(type: "char(3)", unicode: false, maxLength: 3, nullable: true),
                    PaymentStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    PaymentOccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    PaymentFailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProcessedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntil = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ProcessingStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ProcessingAttempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FailureDetail = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DuplicateCount = table.Column<int>(type: "int", nullable: false),
                    LastDuplicateReceivedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    SecurityIncidentCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SecurityIncidentCount = table.Column<int>(type: "int", nullable: false),
                    LastSecurityIncidentAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningWebhookInboxEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningWebhookInboxEvents_Attempts", "[ProcessingAttempts] >= 0");
                    table.CheckConstraint("CK_ScreeningWebhookInboxEvents_Duplicates", "[DuplicateCount] >= 0");
                    table.ForeignKey(
                        name: "FK_ScreeningWebhookInboxEvents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningIncidentEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScreeningIncidentId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    EvidenceReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningIncidentEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningIncidentEvents_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningIncidentEvents_ScreeningIncidents_ScreeningIncidentId",
                        column: x => x.ScreeningIncidentId,
                        principalSchema: "screening",
                        principalTable: "ScreeningIncidents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningIncidentEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningDisputes",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LocalDisputeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ProviderDisputeReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OpenedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ResolvedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    OriginalScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: false),
                    CorrectedScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: true),
                    OpenedByActorType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    OpenedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    IssueCodesJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    NotesSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    RetentionExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningDisputes", x => x.Id);
                    table.CheckConstraint("CK_ScreeningDisputes_IssueCodesJson", "ISJSON([IssueCodesJson]) = 1");
                    table.CheckConstraint("CK_ScreeningDisputes_ResolvedAt", "[ResolvedAt] IS NULL OR [ResolvedAt] >= [OpenedAt]");
                    table.ForeignKey(
                        name: "FK_ScreeningDisputes_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputes_ScreeningReportRevisions_CorrectedScreeningReportRevisionId",
                        column: x => x.CorrectedScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputes_ScreeningReportRevisions_OriginalScreeningReportRevisionId",
                        column: x => x.OriginalScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputes_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputes_Users_OpenedByUserId",
                        column: x => x.OpenedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningRentalDecisionRevisions",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    DecisionActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CriteriaVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CriteriaSnapshotSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    ReliedUponScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: true),
                    ReasonCodesJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    SupersedesScreeningRentalDecisionRevisionId = table.Column<long>(type: "bigint", nullable: true),
                    IsFrozenByDispute = table.Column<bool>(type: "bit", nullable: false),
                    DisputeStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningRentalDecisionRevisions", x => x.Id);
                    table.CheckConstraint("CK_ScreeningRentalDecisionRevisions_ReasonCodesJson", "ISJSON([ReasonCodesJson]) = 1");
                    table.CheckConstraint("CK_ScreeningRentalDecisionRevisions_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_ScreeningRentalDecisionRevisions_SupersedesScreeningRentalDecisionRevisionId",
                        column: x => x.SupersedesScreeningRentalDecisionRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningRentalDecisionRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_ScreeningReportRevisions_ReliedUponScreeningReportRevisionId",
                        column: x => x.ReliedUponScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningRentalDecisionRevisions_Users_DecisionActorUserId",
                        column: x => x.DecisionActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningReportAccessAudits",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    ScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: false),
                    AttemptSequence = table.Column<long>(type: "bigint", nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    RequestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    ScreeningSupportElevationId = table.Column<long>(type: "bigint", nullable: true),
                    GrantExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    GrantReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningReportAccessAudits", x => x.Id);
                    table.CheckConstraint("CK_ScreeningReportAccessAudits_Grant", "([Status] = 'Granted' AND [GrantReference] IS NOT NULL AND [GrantExpiresAt] IS NOT NULL) OR ([Status] <> 'Granted' AND [GrantReference] IS NULL AND [GrantExpiresAt] IS NULL)");
                    table.CheckConstraint("CK_ScreeningReportAccessAudits_Sequence", "[AttemptSequence] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningReportAccessAudits_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportAccessAudits_ScreeningReportRevisions_ScreeningReportRevisionId",
                        column: x => x.ScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportAccessAudits_ScreeningSupportElevations_ScreeningSupportElevationId",
                        column: x => x.ScreeningSupportElevationId,
                        principalSchema: "screening",
                        principalTable: "ScreeningSupportElevations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportAccessAudits_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportAccessAudits_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningReportDeletionEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ReasonCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningReportDeletionEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningReportDeletionEvents_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningReportDeletionEvents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportDeletionEvents_ScreeningReportRevisions_ScreeningReportRevisionId",
                        column: x => x.ScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReportDeletionEvents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningDisputeEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScreeningDisputeId = table.Column<long>(type: "bigint", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ProviderEventType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProviderEventReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ActorType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningDisputeEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningDisputeEvents_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningDisputeEvents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputeEvents_ScreeningDisputes_ScreeningDisputeId",
                        column: x => x.ScreeningDisputeId,
                        principalSchema: "screening",
                        principalTable: "ScreeningDisputes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputeEvents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningDisputeEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningAdverseActions",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: false),
                    DecisionActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    OriginalScreeningRentalDecisionRevisionId = table.Column<long>(type: "bigint", nullable: false),
                    OriginalScreeningReportRevisionId = table.Column<long>(type: "bigint", nullable: true),
                    ActionType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ReasonCodesJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    RentalCriteriaVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CraContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CraContactAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CraContactPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NoticeVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ImmutableNoticeContent = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: false),
                    NoticeContentSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    StatutoryDisclosureVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StatutoryDisclosureSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    StateLocalDisclosureVersion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StateLocalDisclosureSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    JurisdictionCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ReconsiderationLinkReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningAdverseActions", x => x.Id);
                    table.CheckConstraint("CK_ScreeningAdverseActions_ReasonCodesJson", "ISJSON([ReasonCodesJson]) = 1");
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_ScreeningRentalDecisionRevisions_OriginalScreeningRentalDecisionRevisionId",
                        column: x => x.OriginalScreeningRentalDecisionRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningRentalDecisionRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_ScreeningReportRevisions_OriginalScreeningReportRevisionId",
                        column: x => x.OriginalScreeningReportRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningReportRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActions_Users_DecisionActorUserId",
                        column: x => x.DecisionActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningAdverseActionDeliveryAttempts",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScreeningAdverseActionId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    AttemptNumber = table.Column<int>(type: "int", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    AttemptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    DeliveredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ProviderDeliveryReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NoticeContentSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    ProviderIdempotencyKey = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntil = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningAdverseActionDeliveryAttempts", x => x.Id);
                    table.CheckConstraint("CK_ScreeningAdverseActionDeliveryAttempts_Attempt", "[AttemptNumber] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActionDeliveryAttempts_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActions_ScreeningAdverseActionId",
                        column: x => x.ScreeningAdverseActionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningAdverseActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScreeningReconsiderationEvents",
                schema: "screening",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScreeningAdverseActionId = table.Column<long>(type: "bigint", nullable: false),
                    TenantScreeningOrderId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ToStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OccurredAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    ReasonSha256Hash = table.Column<string>(type: "char(64)", unicode: false, maxLength: 64, nullable: false),
                    NewScreeningRentalDecisionRevisionId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScreeningReconsiderationEvents", x => x.Id);
                    table.CheckConstraint("CK_ScreeningReconsiderationEvents_Revision", "[Revision] > 0");
                    table.ForeignKey(
                        name: "FK_ScreeningReconsiderationEvents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReconsiderationEvents_ScreeningAdverseActions_ScreeningAdverseActionId",
                        column: x => x.ScreeningAdverseActionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningAdverseActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReconsiderationEvents_ScreeningRentalDecisionRevisions_NewScreeningRentalDecisionRevisionId",
                        column: x => x.NewScreeningRentalDecisionRevisionId,
                        principalSchema: "screening",
                        principalTable: "ScreeningRentalDecisionRevisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReconsiderationEvents_TenantScreeningOrders_TenantScreeningOrderId",
                        column: x => x.TenantScreeningOrderId,
                        principalSchema: "screening",
                        principalTable: "TenantScreeningOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScreeningReconsiderationEvents_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActionDeliveryAttempts_OrganizationId",
                schema: "screening",
                table: "ScreeningAdverseActionDeliveryAttempts",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActionDeliveryAttempts_Status_NextAttemptAt_ProcessingLeaseUntil_AttemptedAt",
                schema: "screening",
                table: "ScreeningAdverseActionDeliveryAttempts",
                columns: new[] { "Status", "NextAttemptAt", "ProcessingLeaseUntil", "AttemptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActionDeliveryAttempts_ProviderIdempotencyKey",
                schema: "screening",
                table: "ScreeningAdverseActionDeliveryAttempts",
                column: "ProviderIdempotencyKey");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActionId_AttemptNumber",
                schema: "screening",
                table: "ScreeningAdverseActionDeliveryAttempts",
                columns: new[] { "ScreeningAdverseActionId", "AttemptNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActionId_Channel",
                schema: "screening",
                table: "ScreeningAdverseActionDeliveryAttempts",
                columns: new[] { "ScreeningAdverseActionId", "Channel" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_DecisionActorUserId",
                schema: "screening",
                table: "ScreeningAdverseActions",
                column: "DecisionActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_OrganizationId_CreatedAt",
                schema: "screening",
                table: "ScreeningAdverseActions",
                columns: new[] { "OrganizationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_OrganizationId_OriginalScreeningRentalDecisionRevisionId_ActionType",
                schema: "screening",
                table: "ScreeningAdverseActions",
                columns: new[] { "OrganizationId", "OriginalScreeningRentalDecisionRevisionId", "ActionType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_OrganizationId_RentalApplicationId_CreatedAt",
                schema: "screening",
                table: "ScreeningAdverseActions",
                columns: new[] { "OrganizationId", "RentalApplicationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_OriginalScreeningRentalDecisionRevisionId",
                schema: "screening",
                table: "ScreeningAdverseActions",
                column: "OriginalScreeningRentalDecisionRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_OriginalScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningAdverseActions",
                column: "OriginalScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_RentalApplicationId",
                schema: "screening",
                table: "ScreeningAdverseActions",
                column: "RentalApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningAdverseActions_TenantScreeningOrderId",
                schema: "screening",
                table: "ScreeningAdverseActions",
                column: "TenantScreeningOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_ActorUserId",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_OperationId",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_OrganizationId",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_RentalApplicationId",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                column: "RentalApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_Status_NextAttemptAt_ProcessingLeaseUntil_CreatedAt",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                columns: new[] { "Status", "NextAttemptAt", "ProcessingLeaseUntil", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningCancellationIntents_TenantScreeningOrderId",
                schema: "screening",
                table: "ScreeningCancellationIntents",
                column: "TenantScreeningOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningConsentEvidence_OrganizationId_ConsentedAt",
                schema: "screening",
                table: "ScreeningConsentEvidence",
                columns: new[] { "OrganizationId", "ConsentedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningConsentEvidence_TenantScreeningOrderId",
                schema: "screening",
                table: "ScreeningConsentEvidence",
                column: "TenantScreeningOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputeEvents_ActorUserId",
                schema: "screening",
                table: "ScreeningDisputeEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputeEvents_OrganizationId_RecordedAt",
                schema: "screening",
                table: "ScreeningDisputeEvents",
                columns: new[] { "OrganizationId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputeEvents_ScreeningDisputeId_ProviderEventReference",
                schema: "screening",
                table: "ScreeningDisputeEvents",
                columns: new[] { "ScreeningDisputeId", "ProviderEventReference" },
                unique: true,
                filter: "[ProviderEventReference] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputeEvents_ScreeningDisputeId_Revision",
                schema: "screening",
                table: "ScreeningDisputeEvents",
                columns: new[] { "ScreeningDisputeId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputeEvents_TenantScreeningOrderId_OccurredAt",
                schema: "screening",
                table: "ScreeningDisputeEvents",
                columns: new[] { "TenantScreeningOrderId", "OccurredAt" });

            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_ActorUserId", schema: "screening", table: "ScreeningDisputeIntents", column: "ActorUserId");
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_OperationId", schema: "screening", table: "ScreeningDisputeIntents", column: "OperationId", unique: true);
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_OrganizationId", schema: "screening", table: "ScreeningDisputeIntents", column: "OrganizationId");
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_RentalApplicationId", schema: "screening", table: "ScreeningDisputeIntents", column: "RentalApplicationId");
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_ScreeningReportRevisionId", schema: "screening", table: "ScreeningDisputeIntents", column: "ScreeningReportRevisionId");
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_Status_NextAttemptAt_ProcessingLeaseUntil_CreatedAt", schema: "screening", table: "ScreeningDisputeIntents", columns: new[] { "Status", "NextAttemptAt", "ProcessingLeaseUntil", "CreatedAt" });
            migrationBuilder.CreateIndex(name: "IX_ScreeningDisputeIntents_TenantScreeningOrderId_ScreeningReportRevisionId", schema: "screening", table: "ScreeningDisputeIntents", columns: new[] { "TenantScreeningOrderId", "ScreeningReportRevisionId" }, unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_CorrectedScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningDisputes",
                column: "CorrectedScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_LocalDisputeId",
                schema: "screening",
                table: "ScreeningDisputes",
                column: "LocalDisputeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_OpenedByUserId",
                schema: "screening",
                table: "ScreeningDisputes",
                column: "OpenedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_OrganizationId_RetentionExpiresAt",
                schema: "screening",
                table: "ScreeningDisputes",
                columns: new[] { "OrganizationId", "RetentionExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_OrganizationId_Status_ResolvedAt",
                schema: "screening",
                table: "ScreeningDisputes",
                columns: new[] { "OrganizationId", "Status", "ResolvedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_OriginalScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningDisputes",
                column: "OriginalScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_ProviderKey_ProviderDisputeReference",
                schema: "screening",
                table: "ScreeningDisputes",
                columns: new[] { "ProviderKey", "ProviderDisputeReference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningDisputes_TenantScreeningOrderId_OpenedAt",
                schema: "screening",
                table: "ScreeningDisputes",
                columns: new[] { "TenantScreeningOrderId", "OpenedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidentEvents_ActorUserId",
                schema: "screening",
                table: "ScreeningIncidentEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidentEvents_ScreeningIncidentId_Revision",
                schema: "screening",
                table: "ScreeningIncidentEvents",
                columns: new[] { "ScreeningIncidentId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidentEvents_Status_OccurredAt",
                schema: "screening",
                table: "ScreeningIncidentEvents",
                columns: new[] { "Status", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidents_ActorUserId",
                schema: "screening",
                table: "ScreeningIncidents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidents_OrganizationId_Status_DetectedAt",
                schema: "screening",
                table: "ScreeningIncidents",
                columns: new[] { "OrganizationId", "Status", "DetectedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidents_ProviderKey_ProviderEventId_IncidentType",
                schema: "screening",
                table: "ScreeningIncidents",
                columns: new[] { "ProviderKey", "ProviderEventId", "IncidentType" },
                filter: "[ProviderEventId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningIncidents_TenantScreeningOrderId_DetectedAt",
                schema: "screening",
                table: "ScreeningIncidents",
                columns: new[] { "TenantScreeningOrderId", "DetectedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningPaymentEvidence_ActorUserId",
                schema: "screening",
                table: "ScreeningPaymentEvidence",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningPaymentEvidence_OrganizationId_RecordedAt",
                schema: "screening",
                table: "ScreeningPaymentEvidence",
                columns: new[] { "OrganizationId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningPaymentEvidence_TenantScreeningOrderId_PaymentOperationReferenceHash_Status",
                schema: "screening",
                table: "ScreeningPaymentEvidence",
                columns: new[] { "TenantScreeningOrderId", "PaymentOperationReferenceHash", "Status" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningPaymentEvidence_TenantScreeningOrderId_Revision",
                schema: "screening",
                table: "ScreeningPaymentEvidence",
                columns: new[] { "TenantScreeningOrderId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReconsiderationEvents_ActorUserId",
                schema: "screening",
                table: "ScreeningReconsiderationEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReconsiderationEvents_NewScreeningRentalDecisionRevisionId",
                schema: "screening",
                table: "ScreeningReconsiderationEvents",
                column: "NewScreeningRentalDecisionRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReconsiderationEvents_OrganizationId_RecordedAt",
                schema: "screening",
                table: "ScreeningReconsiderationEvents",
                columns: new[] { "OrganizationId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReconsiderationEvents_ScreeningAdverseActionId_Revision",
                schema: "screening",
                table: "ScreeningReconsiderationEvents",
                columns: new[] { "ScreeningAdverseActionId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReconsiderationEvents_TenantScreeningOrderId_OccurredAt",
                schema: "screening",
                table: "ScreeningReconsiderationEvents",
                columns: new[] { "TenantScreeningOrderId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_DecisionActorUserId",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                column: "DecisionActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_OrganizationId_RentalApplicationId_CreatedAt",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                columns: new[] { "OrganizationId", "RentalApplicationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_ReliedUponScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                column: "ReliedUponScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_RentalApplicationId",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                column: "RentalApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_SupersedesScreeningRentalDecisionRevisionId",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                column: "SupersedesScreeningRentalDecisionRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningRentalDecisionRevisions_TenantScreeningOrderId_Revision",
                schema: "screening",
                table: "ScreeningRentalDecisionRevisions",
                columns: new[] { "TenantScreeningOrderId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_ActorUserId",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_OrganizationId_RequestedAt",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                columns: new[] { "OrganizationId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_ScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                column: "ScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_ScreeningSupportElevationId",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                column: "ScreeningSupportElevationId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_Status_RequestedAt",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                columns: new[] { "Status", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportAccessAudits_TenantScreeningOrderId_AttemptSequence",
                schema: "screening",
                table: "ScreeningReportAccessAudits",
                columns: new[] { "TenantScreeningOrderId", "AttemptSequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportDeletionEvents_OrganizationId_OccurredAt",
                schema: "screening",
                table: "ScreeningReportDeletionEvents",
                columns: new[] { "OrganizationId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportDeletionEvents_ScreeningReportRevisionId_Revision",
                schema: "screening",
                table: "ScreeningReportDeletionEvents",
                columns: new[] { "ScreeningReportRevisionId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportDeletionEvents_TenantScreeningOrderId",
                schema: "screening",
                table: "ScreeningReportDeletionEvents",
                column: "TenantScreeningOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportRevisions_OrganizationId_IsUnderLegalHold_DeleteRequestedAt",
                schema: "screening",
                table: "ScreeningReportRevisions",
                columns: new[] { "OrganizationId", "IsUnderLegalHold", "DeleteRequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportRevisions_OrganizationId_RetentionExpiresAt_DeletedAt",
                schema: "screening",
                table: "ScreeningReportRevisions",
                columns: new[] { "OrganizationId", "RetentionExpiresAt", "DeletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportRevisions_ProviderKey_ProviderReportReference",
                schema: "screening",
                table: "ScreeningReportRevisions",
                columns: new[] { "ProviderKey", "ProviderReportReference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportRevisions_SupersedesScreeningReportRevisionId",
                schema: "screening",
                table: "ScreeningReportRevisions",
                column: "SupersedesScreeningReportRevisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningReportRevisions_TenantScreeningOrderId_Revision",
                schema: "screening",
                table: "ScreeningReportRevisions",
                columns: new[] { "TenantScreeningOrderId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningSupportElevations_ApprovedByUserId",
                schema: "screening",
                table: "ScreeningSupportElevations",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningSupportElevations_OrganizationId_SubjectUserId_Purpose_ExpiresAt_RevokedAt",
                schema: "screening",
                table: "ScreeningSupportElevations",
                columns: new[] { "OrganizationId", "SubjectUserId", "Purpose", "ExpiresAt", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningSupportElevations_RevokedByUserId",
                schema: "screening",
                table: "ScreeningSupportElevations",
                column: "RevokedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningSupportElevations_SubjectUserId",
                schema: "screening",
                table: "ScreeningSupportElevations",
                column: "SubjectUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningTransitionEvents_ActorUserId",
                schema: "screening",
                table: "ScreeningTransitionEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningTransitionEvents_OrganizationId_RecordedAt",
                schema: "screening",
                table: "ScreeningTransitionEvents",
                columns: new[] { "OrganizationId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningTransitionEvents_ProviderKey_ProviderEventId",
                schema: "screening",
                table: "ScreeningTransitionEvents",
                columns: new[] { "ProviderKey", "ProviderEventId" },
                unique: true,
                filter: "[ProviderEventId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningTransitionEvents_TenantScreeningOrderId_Revision",
                schema: "screening",
                table: "ScreeningTransitionEvents",
                columns: new[] { "TenantScreeningOrderId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningWebhookInboxEvents_ProcessedAt",
                schema: "screening",
                table: "ScreeningWebhookInboxEvents",
                column: "ProcessedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningWebhookInboxEvents_ProcessingStatus_NextAttemptAt_ProcessingLeaseUntil",
                schema: "screening",
                table: "ScreeningWebhookInboxEvents",
                columns: new[] { "ProcessingStatus", "NextAttemptAt", "ProcessingLeaseUntil" });

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningWebhookInboxEvents_ProviderKey_ProviderEventId",
                schema: "screening",
                table: "ScreeningWebhookInboxEvents",
                columns: new[] { "ProviderKey", "ProviderEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScreeningWebhookInboxEvents_TenantScreeningOrderId",
                schema: "screening",
                table: "ScreeningWebhookInboxEvents",
                column: "TenantScreeningOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_OrganizationId_CompletedAt",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "OrganizationId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_OrganizationId_ExpiredAt",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "OrganizationId", "ExpiredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_OrganizationId_InvitationIdempotencyKeyHash",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "OrganizationId", "InvitationIdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_OrganizationId_RentalApplicationId",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "OrganizationId", "RentalApplicationId" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_OrganizationId_Status_CreatedAt",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "OrganizationId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_PropertyId",
                schema: "screening",
                table: "TenantScreeningOrders",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_ProviderKey_ProviderOrderId",
                schema: "screening",
                table: "TenantScreeningOrders",
                columns: new[] { "ProviderKey", "ProviderOrderId" },
                unique: true,
                filter: "[ProviderOrderId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_RentalApplicationId",
                schema: "screening",
                table: "TenantScreeningOrders",
                column: "RentalApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantScreeningOrders_RequesterUserId",
                schema: "screening",
                table: "TenantScreeningOrders",
                column: "RequesterUserId");

            // Defense in depth: immutable compliance evidence cannot be rewritten even by SQL paths that bypass EF.
            foreach (var table in new[] { "ScreeningPaymentEvidence", "ScreeningTransitionEvents", "ScreeningConsentEvidence",
                         "ScreeningReportDeletionEvents", "ScreeningDisputeEvents", "ScreeningReconsiderationEvents",
                         "ScreeningIncidentEvents", "ScreeningAdverseActions" })
            {
                migrationBuilder.Sql($"""
                    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_{table}]
                    ON [screening].[{table}] AFTER UPDATE, DELETE AS
                    BEGIN
                        SET NOCOUNT ON;
                        IF EXISTS (SELECT 1 FROM deleted)
                            THROW 51000, ''Screening evidence is append-only.'', 1;
                    END');
                    """);
            }

            AddImmutableEvidenceTrigger("ScreeningRentalDecisionRevisions", "Id", "TenantScreeningOrderId", "OrganizationId",
                "RentalApplicationId", "Revision", "DecisionActorUserId", "Decision", "CriteriaVersion",
                "CriteriaSnapshotSha256Hash", "ReliedUponScreeningReportRevisionId", "ReasonCodesJson", "CreatedAt",
                "SupersedesScreeningRentalDecisionRevisionId");
            AddImmutableEvidenceTrigger("ScreeningReportRevisions", "Id", "TenantScreeningOrderId", "OrganizationId", "Revision",
                "ProviderKey", "ProviderReportReference", "ReceivedAt", "ProviderOccurredAt", "CorrectedAt", "Status",
                "ReportVersion", "NormalizedFactsSha256Hash", "SupersedesScreeningReportRevisionId", "RetentionExpiresAt",
                "RetentionSignal");
            AddImmutableEvidenceTrigger("ScreeningWebhookInboxEvents", "Id", "ProviderKey", "ProviderEventId",
                "PayloadSha256Hash", "ReceivedAt", "OccurredAt", "SignedAt", "AuthenticationScheme",
                "AuthenticationKeyVersion", "ProviderSequence", "ProviderOrderId", "CanonicalStatus", "NormalizedReasonCode",
                "PaymentQuoteReferenceHash", "PaymentOperationReferenceHash", "PaymentPayer", "PaymentLandlordAmountMinor",
                "PaymentApplicantAmountMinor", "PaymentProviderAmountMinor", "PaymentPlatformFeeMinor", "PaymentTaxAmountMinor",
                "PaymentTotalAmountMinor", "PaymentCurrency", "PaymentStatus", "PaymentOccurredAt", "PaymentFailureCode");
            AddImmutableEvidenceTrigger("ScreeningCancellationIntents", "Id", "OperationId", "TenantScreeningOrderId",
                "OrganizationId", "RentalApplicationId", "ActorUserId", "ExpectedOrderRevision", "ProviderKey",
                "ProviderOrderId", "ReasonCode", "CreatedAt");
            AddImmutableEvidenceTrigger("ScreeningDisputeIntents", "Id", "OperationId", "TenantScreeningOrderId",
                "OrganizationId", "RentalApplicationId", "ScreeningReportRevisionId", "ProviderKey", "ProviderOrderId",
                "ProviderReportReference", "ActorType", "ActorUserId", "IssueCodesJson", "NotesSha256Hash",
                "RetentionExpiresAt", "CreatedAt");
            AddImmutableEvidenceTrigger("ScreeningReportAccessAudits", "Id", "TenantScreeningOrderId", "OrganizationId",
                "ActorUserId", "ScreeningReportRevisionId", "AttemptSequence", "Purpose", "RequestedAt",
                "ScreeningSupportElevationId");
            AddImmutableEvidenceTrigger("ScreeningSupportElevations", "Id", "OrganizationId", "SubjectUserId",
                "ApprovedByUserId", "CaseReference", "Reason", "Purpose", "IssuedAt", "ExpiresAt", "MaximumAccessCount");
            AddImmutableEvidenceTrigger("ScreeningDisputes", "Id", "LocalDisputeId", "TenantScreeningOrderId",
                "OrganizationId", "ProviderKey", "ProviderDisputeReference", "OpenedAt", "OriginalScreeningReportRevisionId",
                "OpenedByActorType", "OpenedByUserId", "IssueCodesJson", "NotesSha256Hash", "RetentionExpiresAt");
            AddImmutableEvidenceTrigger("ScreeningAdverseActionDeliveryAttempts", "Id", "ScreeningAdverseActionId",
                "OrganizationId", "AttemptNumber", "Channel", "NoticeContentSha256Hash", "ProviderIdempotencyKey");
            AddImmutableEvidenceTrigger("ScreeningIncidents", "Id", "OrganizationId", "TenantScreeningOrderId",
                "ProviderKey", "ProviderEventId", "IncidentType", "Severity", "DetectedAt", "AffectedResourceSha256Hash",
                "DetectionSource", "FailureEvidenceReference");

            void AddImmutableEvidenceTrigger(string table, params string[] immutableColumns)
            {
                var immutableUpdate = string.Join(" OR ", immutableColumns.Select(column => $"UPDATE([{column}])"));
                migrationBuilder.Sql($"""
                    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_{table}]
                    ON [screening].[{table}] AFTER UPDATE, DELETE AS
                    BEGIN
                        SET NOCOUNT ON;
                        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
                            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
                        IF {immutableUpdate}
                            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
                    END');
                    """);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScreeningDisputeIntents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningAdverseActionDeliveryAttempts",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningCancellationIntents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningConsentEvidence",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningDisputeEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningIncidentEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningPaymentEvidence",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningReconsiderationEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningReportAccessAudits",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningReportDeletionEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningTransitionEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningWebhookInboxEvents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningDisputes",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningIncidents",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningAdverseActions",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningSupportElevations",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningRentalDecisionRevisions",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "ScreeningReportRevisions",
                schema: "screening");

            migrationBuilder.DropTable(
                name: "TenantScreeningOrders",
                schema: "screening");

            migrationBuilder.AddColumn<bool>(
                name: "BackgroundCheckOverallPass",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckProvider",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckRejectionReason",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckReportUrl",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckRequestId",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BackgroundCheckRequested",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BackgroundCheckRequestedAt",
                schema: "tenant",
                table: "RentalApplications",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckStatus",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundCheckSummary",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreditScore",
                schema: "tenant",
                table: "RentalApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedCreditCheck",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedCriminalCheck",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedEvictionCheck",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PassedIncomeVerification",
                schema: "tenant",
                table: "RentalApplications",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Ssn",
                schema: "tenant",
                table: "RentalApplications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }
    }
}
