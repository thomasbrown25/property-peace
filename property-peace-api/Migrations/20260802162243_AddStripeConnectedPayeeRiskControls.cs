using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeConnectedPayeeRiskControls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The original rent-payment migration incorrectly rejected legitimate overlapping
            // cumulative refund and dispute reports. Each Stripe counter is independently capped;
            // effective loss/reversal exposure is capped at AmountCents by application logic.
            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");

            migrationBuilder.CreateTable(
                name: "StripeConnectedPayeeReviews",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    StripeAccountId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ApprovedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    ApprovalEvidence = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ApprovalNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    PropertyAuthorityAttested = table.Column<bool>(type: "bit", nullable: false),
                    ApprovedOrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    SuspendedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    SuspendedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    SuspensionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    InstantPayoutsAllowed = table.Column<bool>(type: "bit", nullable: false),
                    PayoutSchedulePolicy = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    LastStripeSnapshotAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    StripeDetailsSubmitted = table.Column<bool>(type: "bit", nullable: false),
                    StripePayoutsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    StripeTransfersActive = table.Column<bool>(type: "bit", nullable: false),
                    StripeTransferCapabilityStatus = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    CurrentlyDueRequirementCount = table.Column<int>(type: "int", nullable: false),
                    PastDueRequirementCount = table.Column<int>(type: "int", nullable: false),
                    StripeDisabledReason = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ExternalAccountFingerprint = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    LastStripeEventId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeConnectedPayeeReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StripeConnectedPayeeReviews_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectedPayeeReviews_ApprovedOrganizationId_Status",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                columns: new[] { "ApprovedOrganizationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectedPayeeReviews_Status_UpdatedAt",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                columns: new[] { "Status", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectedPayeeReviews_StripeAccountId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                column: "StripeAccountId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectedPayeeReviews_UserId",
                schema: "financial",
                table: "StripeConnectedPayeeReviews",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.Sql(
                """
                IF EXISTS (
                    SELECT [StripeAccountId]
                    FROM [core].[Users]
                    WHERE [StripeAccountId] IS NOT NULL AND LTRIM(RTRIM([StripeAccountId])) <> '' AND [IsDeleted] = 0
                    GROUP BY [StripeAccountId]
                    HAVING COUNT(*) > 1
                )
                    THROW 51000, 'Duplicate Stripe connected-account ownership must be resolved before applying payee-risk controls.', 1;

                INSERT INTO [financial].[StripeConnectedPayeeReviews]
                    ([UserId], [StripeAccountId], [Status], [CreatedAt], [UpdatedAt],
                     [PropertyAuthorityAttested], [InstantPayoutsAllowed], [PayoutSchedulePolicy],
                     [StripeDetailsSubmitted], [StripePayoutsEnabled], [StripeTransfersActive],
                     [CurrentlyDueRequirementCount], [PastDueRequirementCount])
                SELECT [Id], [StripeAccountId], 'UnderReview', SYSUTCDATETIME(), SYSUTCDATETIME(),
                       0, 0, 'manual', 0, 0, 0, 0, 0
                FROM [core].[Users]
                WHERE [StripeAccountId] IS NOT NULL AND LTRIM(RTRIM([StripeAccountId])) <> '' AND [IsDeleted] = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeConnectedPayeeReviews",
                schema: "financial");

            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents] AND [RefundedAmountCents] + [DisputedAmountCents] <= [AmountCents]");
        }
    }
}
