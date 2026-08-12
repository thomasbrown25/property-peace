using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Milestone8MaintenanceWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PortalUserId",
                schema: "financial",
                table: "Vendors",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AcknowledgeByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ActionByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EstimateRequired",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LandlordSummary",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocationDetails",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MissingInformationJson",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResolutionCycle",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<bool>(
                name: "StopTroubleshooting",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StructuredIntakeJson",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(max)",
                maxLength: 8000,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SubmittedByTenantId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SubmittedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SubmittedUnderLeaseId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TriagePolicyVersion",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "TriagedAtUtc",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Urgency",
                schema: "maintenance",
                table: "MaintenanceRequests",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Routine");

            migrationBuilder.CreateTable(
                name: "MaintenanceActivityEvents",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SubjectType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SubjectId = table.Column<long>(type: "bigint", nullable: false),
                    Visibility = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    MetadataJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceActivityEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceActivityEvents_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceAttachments",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ResolutionCycle = table.Column<int>(type: "int", nullable: false),
                    MediaType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    BlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    StagingBlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UploadedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LifecycleState = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    LifecycleLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LifecycleLeaseUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceAttachments_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceCommandReceipts",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: false),
                    Operation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IdempotencyKeyHash = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: false),
                    RequestHash = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: false),
                    ResponseJson = table.Column<string>(type: "nvarchar(max)", maxLength: 16000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceCommandReceipts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceEstimates",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    VendorId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "nchar(3)", fixedLength: true, maxLength: 3, nullable: false),
                    Scope = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    ValidUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SubmittedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    ApprovedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    DecidedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    DecidedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DecisionReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceEstimates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceEstimates_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaintenanceEstimates_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalSchema: "financial",
                        principalTable: "Vendors",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MaintenancePreferredWindows",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AccessInstructions = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenancePreferredWindows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenancePreferredWindows_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceTroubleshootingSteps",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    ResolutionCycleKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StepKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StepCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Instruction = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Outcome = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TenantResponse = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AttemptedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceTroubleshootingSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceTroubleshootingSteps_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceTimelineOutbox",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceActivityEventId = table.Column<long>(type: "bigint", nullable: false),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    AvailableAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ProcessedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeadLetteredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastErrorCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(7)", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceTimelineOutbox", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceTimelineOutbox_MaintenanceActivityEvents_MaintenanceActivityEventId",
                        column: x => x.MaintenanceActivityEventId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceActivityEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceWorkOrders",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    MaintenanceEstimateId = table.Column<long>(type: "bigint", nullable: true),
                    VendorId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    Scope = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    AuthorizedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    IssuedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DueAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    IssuedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    CancelledByUserId = table.Column<long>(type: "bigint", nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceWorkOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceWorkOrders_MaintenanceEstimates_MaintenanceEstimateId",
                        column: x => x.MaintenanceEstimateId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceEstimates",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MaintenanceWorkOrders_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaintenanceWorkOrders_Vendors_VendorId",
                        column: x => x.VendorId,
                        principalSchema: "financial",
                        principalTable: "Vendors",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceAppointments",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    MaintenanceWorkOrderId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    EndsAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ProposedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    ConfirmedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    CancelledByUserId = table.Column<long>(type: "bigint", nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceAppointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceAppointments_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaintenanceAppointments_MaintenanceWorkOrders_MaintenanceWorkOrderId",
                        column: x => x.MaintenanceWorkOrderId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceWorkOrders",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceCompletions",
                schema: "maintenance",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: false),
                    MaintenanceWorkOrderId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    ResolutionNotes = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    CompletionEvidenceReference = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    FinalCost = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    TenantConfirmationDueAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ConfirmedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    DecidedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    DecidedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DecisionReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceCompletions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceCompletions_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MaintenanceCompletions_MaintenanceWorkOrders_MaintenanceWorkOrderId",
                        column: x => x.MaintenanceWorkOrderId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceWorkOrders",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_PortalUserId",
                schema: "financial",
                table: "Vendors",
                column: "PortalUserId",
                unique: true,
                filter: "[PortalUserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_OrganizationId_Urgency_ActionByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests",
                columns: new[] { "OrganizationId", "Urgency", "ActionByUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_SubmittedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceRequests_SubmittedUnderLeaseId",
                schema: "maintenance",
                table: "MaintenanceRequests",
                column: "SubmittedUnderLeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceActivityEvents_MaintenanceRequestId_Id",
                schema: "maintenance",
                table: "MaintenanceActivityEvents",
                columns: new[] { "MaintenanceRequestId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAppointments_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenanceAppointments",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAppointments_MaintenanceRequestId_Status_StartsAtUtc",
                schema: "maintenance",
                table: "MaintenanceAppointments",
                columns: new[] { "MaintenanceRequestId", "Status", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAppointments_MaintenanceWorkOrderId",
                schema: "maintenance",
                table: "MaintenanceAppointments",
                column: "MaintenanceWorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAttachments_BlobName",
                schema: "maintenance",
                table: "MaintenanceAttachments",
                column: "BlobName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAttachments_LifecycleState_LifecycleLeaseUntilUtc_Id",
                schema: "maintenance",
                table: "MaintenanceAttachments",
                columns: new[] { "LifecycleState", "LifecycleLeaseUntilUtc", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAttachments_MaintenanceRequestId_Purpose_ResolutionCycle_LifecycleState",
                schema: "maintenance",
                table: "MaintenanceAttachments",
                columns: new[] { "MaintenanceRequestId", "Purpose", "ResolutionCycle", "LifecycleState" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceCommandReceipts_ActorUserId_Operation_IdempotencyKeyHash",
                schema: "maintenance",
                table: "MaintenanceCommandReceipts",
                columns: new[] { "ActorUserId", "Operation", "IdempotencyKeyHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceCompletions_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenanceCompletions",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceCompletions_MaintenanceRequestId_CompletedAtUtc",
                schema: "maintenance",
                table: "MaintenanceCompletions",
                columns: new[] { "MaintenanceRequestId", "CompletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceCompletions_MaintenanceWorkOrderId",
                schema: "maintenance",
                table: "MaintenanceCompletions",
                column: "MaintenanceWorkOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceEstimates_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenanceEstimates",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceEstimates_MaintenanceRequestId_Status",
                schema: "maintenance",
                table: "MaintenanceEstimates",
                columns: new[] { "MaintenanceRequestId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceEstimates_MaintenanceRequestId_Version",
                schema: "maintenance",
                table: "MaintenanceEstimates",
                columns: new[] { "MaintenanceRequestId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceEstimates_VendorId",
                schema: "maintenance",
                table: "MaintenanceEstimates",
                column: "VendorId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenancePreferredWindows_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenancePreferredWindows",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenancePreferredWindows_MaintenanceRequestId_Status_StartsAtUtc",
                schema: "maintenance",
                table: "MaintenancePreferredWindows",
                columns: new[] { "MaintenanceRequestId", "Status", "StartsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTimelineOutbox_MaintenanceActivityEventId",
                schema: "maintenance",
                table: "MaintenanceTimelineOutbox",
                column: "MaintenanceActivityEventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTimelineOutbox_ProcessedAtUtc_DeadLetteredAtUtc_NextAttemptAtUtc_AvailableAtUtc_ProcessingLeaseUntilUtc",
                schema: "maintenance",
                table: "MaintenanceTimelineOutbox",
                columns: new[] { "ProcessedAtUtc", "DeadLetteredAtUtc", "NextAttemptAtUtc", "AvailableAtUtc", "ProcessingLeaseUntilUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTroubleshootingSteps_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenanceTroubleshootingSteps",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTroubleshootingSteps_MaintenanceRequestId_ResolutionCycleKey_StepCode",
                schema: "maintenance",
                table: "MaintenanceTroubleshootingSteps",
                columns: new[] { "MaintenanceRequestId", "ResolutionCycleKey", "StepCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTroubleshootingSteps_MaintenanceRequestId_ResolutionCycleKey_StepKey",
                schema: "maintenance",
                table: "MaintenanceTroubleshootingSteps",
                columns: new[] { "MaintenanceRequestId", "ResolutionCycleKey", "StepKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceTroubleshootingSteps_MaintenanceRequestId_Sequence",
                schema: "maintenance",
                table: "MaintenanceTroubleshootingSteps",
                columns: new[] { "MaintenanceRequestId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceWorkOrders_MaintenanceEstimateId",
                schema: "maintenance",
                table: "MaintenanceWorkOrders",
                column: "MaintenanceEstimateId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceWorkOrders_MaintenanceRequestId",
                schema: "maintenance",
                table: "MaintenanceWorkOrders",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceWorkOrders_MaintenanceRequestId_Status_DueAtUtc",
                schema: "maintenance",
                table: "MaintenanceWorkOrders",
                columns: new[] { "MaintenanceRequestId", "Status", "DueAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceWorkOrders_MaintenanceRequestId_Version",
                schema: "maintenance",
                table: "MaintenanceWorkOrders",
                columns: new[] { "MaintenanceRequestId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceWorkOrders_VendorId",
                schema: "maintenance",
                table: "MaintenanceWorkOrders",
                column: "VendorId");

            migrationBuilder.AddForeignKey(
                name: "FK_Vendors_Users_PortalUserId",
                schema: "financial",
                table: "Vendors",
                column: "PortalUserId",
                principalSchema: "core",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Vendors_Users_PortalUserId",
                schema: "financial",
                table: "Vendors");

            migrationBuilder.DropTable(
                name: "MaintenanceAppointments",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceAttachments",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceCommandReceipts",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceCompletions",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenancePreferredWindows",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceTimelineOutbox",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceTroubleshootingSteps",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceWorkOrders",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceActivityEvents",
                schema: "maintenance");

            migrationBuilder.DropTable(
                name: "MaintenanceEstimates",
                schema: "maintenance");

            migrationBuilder.DropIndex(
                name: "IX_Vendors_PortalUserId",
                schema: "financial",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_OrganizationId_Urgency_ActionByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_SubmittedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropIndex(
                name: "IX_MaintenanceRequests_SubmittedUnderLeaseId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "PortalUserId",
                schema: "financial",
                table: "Vendors");

            migrationBuilder.DropColumn(
                name: "AcknowledgeByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "ActionByUtc",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "EstimateRequired",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "LandlordSummary",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "LocationDetails",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "MissingInformationJson",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "ResolutionCycle",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "StopTroubleshooting",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "StructuredIntakeJson",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedByTenantId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "SubmittedUnderLeaseId",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "TriagePolicyVersion",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "TriagedAtUtc",
                schema: "maintenance",
                table: "MaintenanceRequests");

            migrationBuilder.DropColumn(
                name: "Urgency",
                schema: "maintenance",
                table: "MaintenanceRequests");
        }
    }
}
