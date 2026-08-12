using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Milestone14ActivationFunnel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                schema: "listing",
                table: "Listings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ActivationMilestoneOccurrences",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Milestone = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SubjectId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2(0)", precision: 0, nullable: false),
                    RecordedAtUtc = table.Column<DateTime>(type: "datetime2(0)", precision: 0, nullable: false),
                    IsTimestampEstimated = table.Column<bool>(type: "bit", nullable: false),
                    ActorUserId = table.Column<long>(type: "bigint", nullable: true),
                    SourceEventType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SourceEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivationMilestoneOccurrences", x => x.Id);
                    table.CheckConstraint("CK_ActivationMilestoneOccurrences_Milestone", "[Milestone] IN ('property_added', 'listing_published', 'lead_received', 'showing_booked', 'application_completed', 'screening_completed', 'lease_signed', 'tenant_invited', 'first_rent_recorded_or_paid', 'maintenance_closed')");
                    table.CheckConstraint("CK_ActivationMilestoneOccurrences_SourcePair", "([SourceEventType] IS NULL AND [SourceEventId] IS NULL) OR ([SourceEventType] IS NOT NULL AND [SourceEventId] IS NOT NULL)");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivationMilestoneOccurrences_OccurredAtUtc_Milestone",
                table: "ActivationMilestoneOccurrences",
                columns: new[] { "OccurredAtUtc", "Milestone" });

            migrationBuilder.CreateIndex(
                name: "UX_ActivationOccurrence_OrganizationMilestoneSubject",
                table: "ActivationMilestoneOccurrences",
                columns: new[] { "OrganizationId", "Milestone", "SubjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ActivationOccurrence_SourceReplay",
                table: "ActivationMilestoneOccurrences",
                columns: new[] { "OrganizationId", "SourceEventType", "SourceEventId" },
                unique: true,
                filter: "[SourceEventType] IS NOT NULL AND [SourceEventId] IS NOT NULL");

            migrationBuilder.Sql(
                """
                CREATE TRIGGER [TR_ActivationMilestoneOccurrences_AppendOnly]
                ON [ActivationMilestoneOccurrences]
                INSTEAD OF UPDATE, DELETE
                AS
                BEGIN
                    SET NOCOUNT ON;
                    THROW 51000, 'Activation milestone occurrences are append-only.', 1;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "IF OBJECT_ID(N'[TR_ActivationMilestoneOccurrences_AppendOnly]', N'TR') IS NOT NULL DROP TRIGGER [TR_ActivationMilestoneOccurrences_AppendOnly]");

            migrationBuilder.DropTable(
                name: "ActivationMilestoneOccurrences");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                schema: "listing",
                table: "Listings");
        }
    }
}
