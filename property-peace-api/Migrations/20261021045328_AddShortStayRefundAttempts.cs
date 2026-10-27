using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayRefundAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShortStayRefundAttempts",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReservationId = table.Column<long>(type: "bigint", nullable: false),
                    PaymentIntentId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FirstAttemptAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LastAttemptAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ManualReviewAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayRefundAttempts", x => x.Id);
                    table.CheckConstraint("CK_ShortStayRefundAttempts_Count", "[AttemptCount] >= 0 AND (([AttemptCount] = 0 AND [FirstAttemptAtUtc] IS NULL AND [LastAttemptAtUtc] IS NULL) OR ([AttemptCount] > 0 AND [FirstAttemptAtUtc] IS NOT NULL AND [LastAttemptAtUtc] >= [FirstAttemptAtUtc]))");
                    table.CheckConstraint("CK_ShortStayRefundAttempts_Review", "([Status] = 'ManualReview' AND [ManualReviewAtUtc] IS NOT NULL) OR ([Status] <> 'ManualReview' AND [ManualReviewAtUtc] IS NULL)");
                    table.CheckConstraint("CK_ShortStayRefundAttempts_Status", "[Status] IN ('Ready','Pending','ManualReview','Succeeded')");
                    table.ForeignKey(
                        name: "FK_ShortStayRefundAttempts_ShortStayReservations_ReservationId",
                        column: x => x.ReservationId,
                        principalSchema: "listing",
                        principalTable: "ShortStayReservations",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayRefundAttempts_IdempotencyKey",
                schema: "listing",
                table: "ShortStayRefundAttempts",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayRefundAttempts_ReservationId",
                schema: "listing",
                table: "ShortStayRefundAttempts",
                column: "ReservationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayRefundAttempts_ReservationId_PaymentIntentId",
                schema: "listing",
                table: "ShortStayRefundAttempts",
                columns: new[] { "ReservationId", "PaymentIntentId" },
                unique: true);
            migrationBuilder.Sql(@"
INSERT INTO [listing].[ShortStayRefundAttempts]
    ([ReservationId], [PaymentIntentId], [IdempotencyKey], [CreatedAtUtc], [FirstAttemptAtUtc], [LastAttemptAtUtc], [AttemptCount], [Status], [ManualReviewAtUtc])
SELECT r.[Id], r.[StripePaymentIntentId], CONCAT('shortstay:', r.[OperationId], ':refund:v1'),
    SYSUTCDATETIME(), NULL, NULL, 0, 'ManualReview', SYSUTCDATETIME()
FROM [listing].[ShortStayReservations] AS r
WHERE r.[Status] = 'RefundRequired' AND r.[StripePaymentIntentId] IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [listing].[ShortStayRefundAttempts] AS a WHERE a.[ReservationId] = r.[Id]);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayRefundAttempts",
                schema: "listing");
        }
    }
}
