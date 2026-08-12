using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class HardenStripeRentDisputeRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_NonnegativeCounters",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DisputeClosedAt",
                schema: "financial",
                table: "StripeRentPayments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DisputeRecoveredAmountCents",
                schema: "financial",
                table: "StripeRentPayments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "StripeDisputeStatus",
                schema: "financial",
                table: "StripeRentPayments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents] AND [DisputeRecoveredAmountCents] <= [AmountCents]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_NonnegativeCounters",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] >= 0 AND [DisputedAmountCents] >= 0 AND [DisputeRecoveredAmountCents] >= 0 AND [ReversedAmountCents] >= 0 AND [ReversalTargetAmountCents] >= 0 AND [ReversalIncrementAmountCents] >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_StripeRentPayments_NonnegativeCounters",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropColumn(
                name: "DisputeClosedAt",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropColumn(
                name: "DisputeRecoveredAmountCents",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropColumn(
                name: "StripeDisputeStatus",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_LossWithinAmount",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StripeRentPayments_NonnegativeCounters",
                schema: "financial",
                table: "StripeRentPayments",
                sql: "[RefundedAmountCents] >= 0 AND [DisputedAmountCents] >= 0 AND [ReversedAmountCents] >= 0 AND [ReversalTargetAmountCents] >= 0 AND [ReversalIncrementAmountCents] >= 0");
        }
    }
}
