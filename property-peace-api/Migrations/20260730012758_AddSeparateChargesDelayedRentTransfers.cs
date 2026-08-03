using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddSeparateChargesDelayedRentTransfers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StripeRentPayments",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperationId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PaymentIntentId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    LeaseId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    TenantUserId = table.Column<long>(type: "bigint", nullable: false),
                    AmountCents = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    DestinationStripeAccountId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    StripeChargeId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    PaymentMethodType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    HeldAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    TransferEligibleAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    StripeTransferId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    StripeTransferReversalId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ReversedAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    ReversalTargetAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    ReversalIncrementAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    TransferAttemptCount = table.Column<int>(type: "int", nullable: false),
                    ReversalAttemptCount = table.Column<int>(type: "int", nullable: false),
                    LastReversalAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastReversalError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LastTransferAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    TransferredAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AllocationCompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RefundedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RefundedAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    DisputedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DisputedAmountCents = table.Column<long>(type: "bigint", nullable: false),
                    NextTransferAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    StripeRefundId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    StripeDisputeId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    RiskReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    LastTransferError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeRentPayments", x => x.Id);
                    table.CheckConstraint("CK_StripeRentPayments_LossWithinAmount", "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");
                    table.CheckConstraint("CK_StripeRentPayments_NonnegativeCounters", "[RefundedAmountCents] >= 0 AND [DisputedAmountCents] >= 0 AND [ReversedAmountCents] >= 0 AND [ReversalTargetAmountCents] >= 0 AND [ReversalIncrementAmountCents] >= 0");
                    table.CheckConstraint("CK_StripeRentPayments_PositiveAmount", "[AmountCents] > 0");
                    table.CheckConstraint("CK_StripeRentPayments_ReversalWithinAmount", "[ReversedAmountCents] <= [AmountCents] AND [ReversalTargetAmountCents] <= [AmountCents] AND [ReversalIncrementAmountCents] <= [AmountCents] AND (([ReversalTargetAmountCents] = 0 AND [ReversalIncrementAmountCents] = 0) OR ([ReversalTargetAmountCents] > [ReversedAmountCents] AND [ReversalIncrementAmountCents] = [ReversalTargetAmountCents] - [ReversedAmountCents]))");
                    table.ForeignKey(
                        name: "FK_StripeRentPayments_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StripeRentPayments_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_LeaseId",
                schema: "financial",
                table: "StripeRentPayments",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_OperationId",
                schema: "financial",
                table: "StripeRentPayments",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_OrganizationId",
                schema: "financial",
                table: "StripeRentPayments",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_PaymentIntentId",
                schema: "financial",
                table: "StripeRentPayments",
                column: "PaymentIntentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_Status_TransferEligibleAt",
                schema: "financial",
                table: "StripeRentPayments",
                columns: new[] { "Status", "TransferEligibleAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StripeRentPayments_StripeTransferId",
                schema: "financial",
                table: "StripeRentPayments",
                column: "StripeTransferId",
                unique: true,
                filter: "[StripeTransferId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeRentPayments",
                schema: "financial");
        }
    }
}
