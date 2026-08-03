using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDurableStripeTransferRetryState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TransferIdempotencyKey",
                schema: "financial",
                table: "StripeRentPayments",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TransferReconciliationPaused",
                schema: "financial",
                table: "StripeRentPayments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "TransferReplayFailureCount",
                schema: "financial",
                table: "StripeRentPayments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Existing in-flight rows were sent with the pre-deployment key format. Replaying any
            // reconstructed attempt key could create a duplicate transfer after an ambiguous result.
            migrationBuilder.Sql(@"
                EXEC(N'UPDATE [financial].[StripeRentPayments]
                SET [TransferIdempotencyKey] = N''rent-transfer:'' + [PaymentIntentId]
                WHERE [Status] IN (N''TransferPending'', N''TransferReconciliationPending'')
                  AND [TransferIdempotencyKey] IS NULL;');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TransferIdempotencyKey",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropColumn(
                name: "TransferReconciliationPaused",
                schema: "financial",
                table: "StripeRentPayments");

            migrationBuilder.DropColumn(
                name: "TransferReplayFailureCount",
                schema: "financial",
                table: "StripeRentPayments");
        }
    }
}
