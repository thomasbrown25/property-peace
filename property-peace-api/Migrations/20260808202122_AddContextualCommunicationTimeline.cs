using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddContextualCommunicationTimeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "StaffVisibilityFromSequence",
                schema: "communication",
                table: "ConversationParticipants",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ConversationContextLinks",
                schema: "communication",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: true),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    ListingId = table.Column<long>(type: "bigint", nullable: true),
                    LeadId = table.Column<long>(type: "bigint", nullable: true),
                    RentalApplicationId = table.Column<long>(type: "bigint", nullable: true),
                    LeaseId = table.Column<long>(type: "bigint", nullable: true),
                    PaymentId = table.Column<long>(type: "bigint", nullable: true),
                    MaintenanceRequestId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationContextLinks", x => x.Id);
                    table.CheckConstraint("CK_ConversationContextLinks_ExactlyOneTarget", "(CASE WHEN [PropertyId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [UnitId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [ListingId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [LeadId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [RentalApplicationId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [LeaseId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [PaymentId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [MaintenanceRequestId] IS NULL THEN 0 ELSE 1 END) = 1");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "communication",
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Leads_LeadId",
                        column: x => x.LeadId,
                        principalSchema: "leasing",
                        principalTable: "Leads",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_MaintenanceRequests_MaintenanceRequestId",
                        column: x => x.MaintenanceRequestId,
                        principalSchema: "maintenance",
                        principalTable: "MaintenanceRequests",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Payments_PaymentId",
                        column: x => x.PaymentId,
                        principalSchema: "financial",
                        principalTable: "Payments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_RentalApplications_RentalApplicationId",
                        column: x => x.RentalApplicationId,
                        principalSchema: "tenant",
                        principalTable: "RentalApplications",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationContextLinks_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ConversationFollowUpTasks",
                schema: "communication",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    TimelineEntryId = table.Column<long>(type: "bigint", nullable: false),
                    ContextKind = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ContextId = table.Column<long>(type: "bigint", nullable: false),
                    AssigneeUserId = table.Column<long>(type: "bigint", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationFollowUpTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConversationReadWatermarks",
                schema: "communication",
                columns: table => new
                {
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    LastReadSequence = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationReadWatermarks", x => new { x.ConversationId, x.UserId });
                });

            migrationBuilder.CreateTable(
                name: "ConversationTimelineEntries",
                schema: "communication",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RecordedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    MessageId = table.Column<long>(type: "bigint", nullable: true),
                    SourceType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SourceId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    MetadataVersion = table.Column<int>(type: "int", nullable: false),
                    MetadataJson = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    ContextKind = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ContextId = table.Column<long>(type: "bigint", nullable: true),
                    ContextLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Visibility = table.Column<int>(type: "int", nullable: false),
                    Producer = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PayloadHash = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationTimelineEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConversationTimelineEntries_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "communication",
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ConversationTimelineEntries_Messages_MessageId",
                        column: x => x.MessageId,
                        principalSchema: "communication",
                        principalTable: "Messages",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ConversationTimelineEntries_Users_ActorUserId",
                        column: x => x.ActorUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ConversationTimelineSequences",
                schema: "communication",
                columns: table => new
                {
                    ConversationId = table.Column<long>(type: "bigint", nullable: false),
                    NextSequence = table.Column<long>(type: "bigint", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationTimelineSequences", x => x.ConversationId);
                    table.ForeignKey(
                        name: "FK_ConversationTimelineSequences_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalSchema: "communication",
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuickReplies",
                schema: "communication",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    OwnerUserId = table.Column<long>(type: "bigint", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ContextKind = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuickReplies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MessageDeliveries",
                schema: "communication",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    ConversationTimelineEntryId = table.Column<long>(type: "bigint", nullable: false),
                    MessageId = table.Column<long>(type: "bigint", nullable: true),
                    Channel = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false),
                    RecipientUserId = table.Column<long>(type: "bigint", nullable: true),
                    ProtectedDestination = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MaskedDestination = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    BodySnapshot = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: false),
                    HtmlBodySnapshot = table.Column<string>(type: "nvarchar(max)", maxLength: 20000, nullable: true),
                    SubjectSnapshot = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ProtectedFromAddress = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Provider = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ProviderMessageId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProcessingLeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProcessingLeaseUntilUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ErrorCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ErrorDetail = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SubmittedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageDeliveries_ConversationTimelineEntries_ConversationTimelineEntryId",
                        column: x => x.ConversationTimelineEntryId,
                        principalSchema: "communication",
                        principalTable: "ConversationTimelineEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MessageDeliveries_Messages_MessageId",
                        column: x => x.MessageId,
                        principalSchema: "communication",
                        principalTable: "Messages",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MessageDeliveries_Users_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            foreach (var target in new[] { "PropertyId", "UnitId", "ListingId", "LeadId", "RentalApplicationId", "LeaseId", "PaymentId", "MaintenanceRequestId" })
            {
                migrationBuilder.CreateIndex(
                    name: $"IX_ConversationContextLinks_ConversationId_{target}",
                    schema: "communication",
                    table: "ConversationContextLinks",
                    columns: new[] { "ConversationId", target },
                    unique: true,
                    filter: $"[{target}] IS NOT NULL");
            }

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_LeadId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_LeaseId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_ListingId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_MaintenanceRequestId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "MaintenanceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_PaymentId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "PaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_PropertyId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_RentalApplicationId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "RentalApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationContextLinks_UnitId",
                schema: "communication",
                table: "ConversationContextLinks",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationFollowUpTasks_OrganizationId_ConversationId_Status_DueAtUtc",
                schema: "communication",
                table: "ConversationFollowUpTasks",
                columns: new[] { "OrganizationId", "ConversationId", "Status", "DueAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ConversationFollowUpTasks_OrganizationId_IdempotencyKey",
                schema: "communication",
                table: "ConversationFollowUpTasks",
                columns: new[] { "OrganizationId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationReadWatermarks_UserId",
                schema: "communication",
                table: "ConversationReadWatermarks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTimelineEntries_ActorUserId",
                schema: "communication",
                table: "ConversationTimelineEntries",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTimelineEntries_ConversationId_Sequence",
                schema: "communication",
                table: "ConversationTimelineEntries",
                columns: new[] { "ConversationId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTimelineEntries_MessageId",
                schema: "communication",
                table: "ConversationTimelineEntries",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationTimelineEntries_OrganizationId_Producer_EventId",
                schema: "communication",
                table: "ConversationTimelineEntries",
                columns: new[] { "OrganizationId", "Producer", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_ConversationTimelineEntryId",
                schema: "communication",
                table: "MessageDeliveries",
                column: "ConversationTimelineEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_MessageId",
                schema: "communication",
                table: "MessageDeliveries",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_OrganizationId_ConversationTimelineEntryId",
                schema: "communication",
                table: "MessageDeliveries",
                columns: new[] { "OrganizationId", "ConversationTimelineEntryId" });

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_OrganizationId_IdempotencyKey",
                schema: "communication",
                table: "MessageDeliveries",
                columns: new[] { "OrganizationId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_Provider_ProviderMessageId",
                schema: "communication",
                table: "MessageDeliveries",
                columns: new[] { "Provider", "ProviderMessageId" },
                unique: true,
                filter: "[ProviderMessageId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_RecipientUserId",
                schema: "communication",
                table: "MessageDeliveries",
                column: "RecipientUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageDeliveries_Status_NextAttemptAtUtc_ProcessingLeaseUntilUtc",
                schema: "communication",
                table: "MessageDeliveries",
                columns: new[] { "Status", "NextAttemptAtUtc", "ProcessingLeaseUntilUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_QuickReplies_OrganizationId_OwnerUserId_SortOrder",
                schema: "communication",
                table: "QuickReplies",
                columns: new[] { "OrganizationId", "OwnerUserId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConversationContextLinks",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "ConversationFollowUpTasks",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "ConversationReadWatermarks",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "ConversationTimelineSequences",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "MessageDeliveries",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "QuickReplies",
                schema: "communication");

            migrationBuilder.DropTable(
                name: "ConversationTimelineEntries",
                schema: "communication");

            migrationBuilder.DropColumn(
                name: "StaffVisibilityFromSequence",
                schema: "communication",
                table: "ConversationParticipants");
        }
    }
}
