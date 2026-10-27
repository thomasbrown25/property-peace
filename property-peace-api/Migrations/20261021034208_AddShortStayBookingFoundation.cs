using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayBookingFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "LodgingTaxRatePercent",
                schema: "listing",
                table: "ShortStayListings",
                type: "decimal(9,4)",
                precision: 9,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TaxPolicyAttestedAtUtc",
                schema: "listing",
                table: "ShortStayListings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "TaxPolicyAttestedByUserId",
                schema: "listing",
                table: "ShortStayListings",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShortStayReservations",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PublicCode = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    OperationId = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    GuestUserId = table.Column<long>(type: "bigint", nullable: false),
                    PayeeUserId = table.Column<long>(type: "bigint", nullable: false),
                    DestinationStripeAccountId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CheckInDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CheckOutDate = table.Column<DateOnly>(type: "date", nullable: false),
                    GuestCount = table.Column<int>(type: "int", nullable: false),
                    TotalCents = table.Column<long>(type: "bigint", nullable: false),
                    NightlySubtotalCents = table.Column<long>(type: "bigint", nullable: false),
                    CleaningFeeCents = table.Column<long>(type: "bigint", nullable: false),
                    TaxCents = table.Column<long>(type: "bigint", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    HoldExpiresAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    StripePaymentIntentId = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    PaymentConfirmedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayReservations", x => x.Id);
                    table.UniqueConstraint("AK_ShortStayReservations_Id_UnitId", x => new { x.Id, x.UnitId });
                    table.CheckConstraint("CK_ShortStayReservations_Confirmation", "[Status] <> 'Confirmed' OR ([StripePaymentIntentId] IS NOT NULL AND [PaymentConfirmedAtUtc] IS NOT NULL)");
                    table.CheckConstraint("CK_ShortStayReservations_Expiry", "[HoldExpiresAtUtc] > [CreatedAtUtc]");
                    table.CheckConstraint("CK_ShortStayReservations_Quote", "[GuestCount] > 0 AND [NightlySubtotalCents] > 0 AND [CleaningFeeCents] >= 0 AND [TaxCents] >= 0 AND [TotalCents] = [NightlySubtotalCents] + [CleaningFeeCents] + [TaxCents] AND [TotalCents] <= 99999999 AND [Currency] = 'usd'");
                    table.CheckConstraint("CK_ShortStayReservations_Range", "[CheckOutDate] > [CheckInDate]");
                    table.CheckConstraint("CK_ShortStayReservations_Status", "[Status] IN ('Held','PendingPayment','Processing','Confirmed','Expired','Failed','RefundRequired','Refunded','Disputed')");
                    table.CheckConstraint("CK_ShortStayReservations_Version", "[RowVersion] > 0");
                    table.ForeignKey(
                        name: "FK_ShortStayReservations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayReservations_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayReservations_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayReservations_Users_GuestUserId",
                        column: x => x.GuestUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayReservations_Users_PayeeUserId",
                        column: x => x.PayeeUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayReservationNights",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReservationId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    PriceCents = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayReservationNights", x => x.Id);
                    table.UniqueConstraint("AK_ShortStayReservationNights_ReservationId_UnitId_Date", x => new { x.ReservationId, x.UnitId, x.Date });
                    table.CheckConstraint("CK_ShortStayReservationNights_Price", "[PriceCents] > 0");
                    table.ForeignKey(
                        name: "FK_ShortStayReservationNights_ShortStayReservations_ReservationId_UnitId",
                        columns: x => new { x.ReservationId, x.UnitId },
                        principalSchema: "listing",
                        principalTable: "ShortStayReservations",
                        principalColumns: new[] { "Id", "UnitId" });
                    table.ForeignKey(
                        name: "FK_ShortStayReservationNights_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayOccupancyClaims",
                schema: "listing",
                columns: table => new
                {
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    ReservationId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayOccupancyClaims", x => new { x.UnitId, x.Date });
                    table.ForeignKey(
                        name: "FK_ShortStayOccupancyClaims_ShortStayReservationNights_ReservationId_UnitId_Date",
                        columns: x => new { x.ReservationId, x.UnitId, x.Date },
                        principalSchema: "listing",
                        principalTable: "ShortStayReservationNights",
                        principalColumns: new[] { "ReservationId", "UnitId", "Date" });
                    table.ForeignKey(
                        name: "FK_ShortStayOccupancyClaims_ShortStayReservations_ReservationId",
                        column: x => x.ReservationId,
                        principalSchema: "listing",
                        principalTable: "ShortStayReservations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayOccupancyClaims_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayListings_LodgingTaxRatePercent",
                schema: "listing",
                table: "ShortStayListings",
                sql: "[LodgingTaxRatePercent] IS NULL OR ([LodgingTaxRatePercent] >= 0 AND [LodgingTaxRatePercent] <= 100)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ShortStayListings_TaxAttestation",
                schema: "listing",
                table: "ShortStayListings",
                sql: "([LodgingTaxRatePercent] IS NULL AND [TaxPolicyAttestedAtUtc] IS NULL AND [TaxPolicyAttestedByUserId] IS NULL) OR ([LodgingTaxRatePercent] IS NOT NULL AND [TaxPolicyAttestedAtUtc] IS NOT NULL AND [TaxPolicyAttestedByUserId] > 0)");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayOccupancyClaims_ReservationId",
                schema: "listing",
                table: "ShortStayOccupancyClaims",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayOccupancyClaims_ReservationId_UnitId_Date",
                schema: "listing",
                table: "ShortStayOccupancyClaims",
                columns: new[] { "ReservationId", "UnitId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservationNights_ReservationId_Date",
                schema: "listing",
                table: "ShortStayReservationNights",
                columns: new[] { "ReservationId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservationNights_UnitId",
                schema: "listing",
                table: "ShortStayReservationNights",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_GuestUserId",
                schema: "listing",
                table: "ShortStayReservations",
                column: "GuestUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_OperationId",
                schema: "listing",
                table: "ShortStayReservations",
                column: "OperationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_OrganizationId_DestinationStripeAccountId",
                schema: "listing",
                table: "ShortStayReservations",
                columns: new[] { "OrganizationId", "DestinationStripeAccountId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_PayeeUserId",
                schema: "listing",
                table: "ShortStayReservations",
                column: "PayeeUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_PropertyId",
                schema: "listing",
                table: "ShortStayReservations",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_PublicCode",
                schema: "listing",
                table: "ShortStayReservations",
                column: "PublicCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_Status_HoldExpiresAtUtc",
                schema: "listing",
                table: "ShortStayReservations",
                columns: new[] { "Status", "HoldExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_StripePaymentIntentId",
                schema: "listing",
                table: "ShortStayReservations",
                column: "StripePaymentIntentId",
                unique: true,
                filter: "[StripePaymentIntentId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayReservations_UnitId_CheckInDate_CheckOutDate",
                schema: "listing",
                table: "ShortStayReservations",
                columns: new[] { "UnitId", "CheckInDate", "CheckOutDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayOccupancyClaims",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayReservationNights",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayReservations",
                schema: "listing");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayListings_LodgingTaxRatePercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ShortStayListings_TaxAttestation",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "LodgingTaxRatePercent",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "TaxPolicyAttestedAtUtc",
                schema: "listing",
                table: "ShortStayListings");

            migrationBuilder.DropColumn(
                name: "TaxPolicyAttestedByUserId",
                schema: "listing",
                table: "ShortStayListings");
        }
    }
}
