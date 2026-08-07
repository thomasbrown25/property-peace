using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddProspectLeadAndShowingCrm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "leasing");

            migrationBuilder.CreateTable(
                name: "Leads",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    NormalizedPhone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    ContactIdentityHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    VerificationTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PublicAccessTokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    VerificationExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ContactVerifiedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    OwnerUserId = table.Column<long>(type: "bigint", nullable: true),
                    AssignedTeamMemberId = table.Column<long>(type: "bigint", nullable: true),
                    NextFollowUpAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ContactedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    QualifiedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ShowingReachedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AppliedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Leads_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Users_AssignedTeamMemberId",
                        column: x => x.AssignedTeamMemberId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PreScreenConfigurations",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    AskMoveInDate = table.Column<bool>(type: "bit", nullable: false),
                    AskOccupants = table.Column<bool>(type: "bit", nullable: false),
                    AskPets = table.Column<bool>(type: "bit", nullable: false),
                    AskSmoking = table.Column<bool>(type: "bit", nullable: false),
                    AskIncomeRange = table.Column<bool>(type: "bit", nullable: false),
                    AskRequestedShowingTime = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreScreenConfigurations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreScreenConfigurations_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PreScreenConfigurations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShowingAvailabilities",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsDisabled = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowingAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowingAvailabilities_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowingAvailabilities_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeadNotes",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    AuthorUserId = table.Column<long>(type: "bigint", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadNotes_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadNotes_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadNotes_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeadSources",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Campaign = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IdempotencyKeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Receipt = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    AttributedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadSources_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadSources_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeadTasks",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    AssigneeUserId = table.Column<long>(type: "bigint", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadTasks_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadTasks_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadTasks_Users_AssigneeUserId",
                        column: x => x.AssigneeUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeadTokenDeliveries",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    Purpose = table.Column<int>(type: "int", nullable: false),
                    ProtectedPayload = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Destination = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NextAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadTokenDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadTokenDeliveries_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadTokenDeliveries_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PreScreenResponses",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    MoveInDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Occupants = table.Column<int>(type: "int", nullable: true),
                    HasPets = table.Column<bool>(type: "bit", nullable: true),
                    Smoking = table.Column<bool>(type: "bit", nullable: true),
                    IncomeRange = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    RequestedShowingAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PreScreenResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PreScreenResponses_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PreScreenResponses_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Showings",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    AvailabilityId = table.Column<long>(type: "bigint", nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    BoundaryTimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IdempotencyKeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RescheduleIdempotencyKeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    RescheduleRequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CancelledAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Showings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Showings_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Showings_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Showings_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Showings_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Showings_ShowingAvailabilities_AvailabilityId",
                        column: x => x.AvailabilityId,
                        principalSchema: "leasing",
                        principalTable: "ShowingAvailabilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Showings_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeadNotificationIntents",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LeadId = table.Column<long>(type: "bigint", nullable: false),
                    ShowingId = table.Column<long>(type: "bigint", nullable: true),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    NotBeforeUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadNotificationIntents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeadNotificationIntents_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadNotificationIntents_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeadNotificationIntents_Showings_ShowingId",
                        column: x => x.ShowingId,
                        principalSchema: "leasing",
                        principalTable: "Showings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShowingOperations",
                schema: "leasing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ShowingId = table.Column<long>(type: "bigint", nullable: false),
                    Operation = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    IdempotencyKeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ResultAvailabilityId = table.Column<long>(type: "bigint", nullable: false),
                    ResultStartsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResultEndsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResultTimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ResultStatus = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShowingOperations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShowingOperations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShowingOperations_Showings_ShowingId",
                        column: x => x.ShowingId,
                        principalSchema: "leasing",
                        principalTable: "Showings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotes_AuthorUserId",
                schema: "leasing",
                table: "LeadNotes",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotes_LeadId",
                schema: "leasing",
                table: "LeadNotes",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotes_OrganizationId",
                schema: "leasing",
                table: "LeadNotes",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_LeadId",
                schema: "leasing",
                table: "LeadNotificationIntents",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_OrganizationId",
                schema: "leasing",
                table: "LeadNotificationIntents",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_ShowingId",
                schema: "leasing",
                table: "LeadNotificationIntents",
                column: "ShowingId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadNotificationIntents_Status_NotBeforeUtc",
                schema: "leasing",
                table: "LeadNotificationIntents",
                columns: new[] { "Status", "NotBeforeUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Leads_AssignedTeamMemberId",
                schema: "leasing",
                table: "Leads",
                column: "AssignedTeamMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_ListingId",
                schema: "leasing",
                table: "Leads",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_OrganizationId_ListingId_ContactIdentityHash",
                schema: "leasing",
                table: "Leads",
                columns: new[] { "OrganizationId", "ListingId", "ContactIdentityHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Leads_OrganizationId_Status_NextFollowUpAtUtc",
                schema: "leasing",
                table: "Leads",
                columns: new[] { "OrganizationId", "Status", "NextFollowUpAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Leads_OwnerUserId",
                schema: "leasing",
                table: "Leads",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_PropertyId",
                schema: "leasing",
                table: "Leads",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_RentalApplicationId",
                schema: "leasing",
                table: "Leads",
                column: "RentalApplicationId",
                unique: true,
                filter: "[RentalApplicationId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_UnitId",
                schema: "leasing",
                table: "Leads",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadSources_LeadId",
                schema: "leasing",
                table: "LeadSources",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadSources_OrganizationId_IdempotencyKeyHash",
                schema: "leasing",
                table: "LeadSources",
                columns: new[] { "OrganizationId", "IdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeadTasks_AssigneeUserId",
                schema: "leasing",
                table: "LeadTasks",
                column: "AssigneeUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTasks_LeadId",
                schema: "leasing",
                table: "LeadTasks",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTasks_OrganizationId",
                schema: "leasing",
                table: "LeadTasks",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTokenDeliveries_LeadId",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTokenDeliveries_OrganizationId",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadTokenDeliveries_Status_NextAttemptAtUtc_CreatedAtUtc",
                schema: "leasing",
                table: "LeadTokenDeliveries",
                columns: new[] { "Status", "NextAttemptAtUtc", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PreScreenConfigurations_ListingId",
                schema: "leasing",
                table: "PreScreenConfigurations",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_PreScreenConfigurations_OrganizationId_ListingId",
                schema: "leasing",
                table: "PreScreenConfigurations",
                columns: new[] { "OrganizationId", "ListingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PreScreenResponses_LeadId",
                schema: "leasing",
                table: "PreScreenResponses",
                column: "LeadId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PreScreenResponses_OrganizationId",
                schema: "leasing",
                table: "PreScreenResponses",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowingAvailabilities_ListingId",
                schema: "leasing",
                table: "ShowingAvailabilities",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ShowingAvailabilities_OrganizationId_ListingId_StartsAtUtc_EndsAtUtc",
                schema: "leasing",
                table: "ShowingAvailabilities",
                columns: new[] { "OrganizationId", "ListingId", "StartsAtUtc", "EndsAtUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowingOperations_OrganizationId_IdempotencyKeyHash",
                schema: "leasing",
                table: "ShowingOperations",
                columns: new[] { "OrganizationId", "IdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShowingOperations_ShowingId",
                schema: "leasing",
                table: "ShowingOperations",
                column: "ShowingId");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_AvailabilityId",
                schema: "leasing",
                table: "Showings",
                column: "AvailabilityId",
                unique: true,
                filter: "[Status] <> 1");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_LeadId",
                schema: "leasing",
                table: "Showings",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_ListingId",
                schema: "leasing",
                table: "Showings",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_OrganizationId_Id_RescheduleIdempotencyKeyHash",
                schema: "leasing",
                table: "Showings",
                columns: new[] { "OrganizationId", "Id", "RescheduleIdempotencyKeyHash" },
                unique: true,
                filter: "[RescheduleIdempotencyKeyHash] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_OrganizationId_LeadId_IdempotencyKeyHash",
                schema: "leasing",
                table: "Showings",
                columns: new[] { "OrganizationId", "LeadId", "IdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Showings_PropertyId",
                schema: "leasing",
                table: "Showings",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Showings_UnitId",
                schema: "leasing",
                table: "Showings",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeadNotes",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "LeadNotificationIntents",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "LeadSources",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "LeadTasks",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "LeadTokenDeliveries",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "PreScreenConfigurations",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "PreScreenResponses",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "ShowingOperations",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "Showings",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "Leads",
                schema: "leasing");

            migrationBuilder.DropTable(
                name: "ShowingAvailabilities",
                schema: "leasing");
        }
    }
}
