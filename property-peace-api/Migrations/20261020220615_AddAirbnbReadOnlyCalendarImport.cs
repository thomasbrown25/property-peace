using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAirbnbReadOnlyCalendarImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShortStayIcalSubscriptions",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    OrgId = table.Column<long>(type: "bigint", nullable: false),
                    EncryptedUrl = table.Column<string>(type: "nvarchar(max)", maxLength: 4096, nullable: false),
                    UrlFingerprint = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Generation = table.Column<long>(type: "bigint", nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSuccessAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailureCode = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ConsecutiveFailures = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LeaseToken = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LeaseExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayIcalSubscriptions", x => x.Id);
                    table.CheckConstraint("CK_ShortStayIcalSubscriptions_ConsecutiveFailures", "[ConsecutiveFailures] >= 0");
                    table.CheckConstraint("CK_ShortStayIcalSubscriptions_EncryptedUrl", "[Enabled] = 0 OR [EncryptedUrl] <> ''");
                    table.CheckConstraint("CK_ShortStayIcalSubscriptions_Generation", "[Generation] >= 1");
                    table.CheckConstraint("CK_ShortStayIcalSubscriptions_LeasePair", "([LeaseToken] IS NULL AND [LeaseExpiresAtUtc] IS NULL) OR ([LeaseToken] IS NOT NULL AND [LeaseExpiresAtUtc] IS NOT NULL)");
                    table.CheckConstraint("CK_ShortStayIcalSubscriptions_UrlFingerprint", "[Enabled] = 0 OR [UrlFingerprint] <> ''");
                    table.ForeignKey(
                        name: "FK_ShortStayIcalSubscriptions_Organizations_OrgId",
                        column: x => x.OrgId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShortStayIcalSubscriptions_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayIcalOccurrences",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubscriptionId = table.Column<long>(type: "bigint", nullable: false),
                    UidKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    RecurrenceKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayIcalOccurrences", x => x.Id);
                    table.CheckConstraint("CK_ShortStayIcalOccurrences_DateRange", "[EndDate] > [StartDate]");
                    table.CheckConstraint("CK_ShortStayIcalOccurrences_RecurrenceKey", "[RecurrenceKey] <> ''");
                    table.CheckConstraint("CK_ShortStayIcalOccurrences_UidKey", "[UidKey] <> ''");
                    table.ForeignKey(
                        name: "FK_ShortStayIcalOccurrences_ShortStayIcalSubscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalSchema: "listing",
                        principalTable: "ShortStayIcalSubscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalOccurrences_SubscriptionId_StartDate_EndDate",
                schema: "listing",
                table: "ShortStayIcalOccurrences",
                columns: new[] { "SubscriptionId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalOccurrences_SubscriptionId_UidKey_RecurrenceKey",
                schema: "listing",
                table: "ShortStayIcalOccurrences",
                columns: new[] { "SubscriptionId", "UidKey", "RecurrenceKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalSubscriptions_Enabled_NextAttemptAtUtc_LeaseExpiresAtUtc",
                schema: "listing",
                table: "ShortStayIcalSubscriptions",
                columns: new[] { "Enabled", "NextAttemptAtUtc", "LeaseExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalSubscriptions_LeaseToken",
                schema: "listing",
                table: "ShortStayIcalSubscriptions",
                column: "LeaseToken",
                unique: true,
                filter: "[LeaseToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalSubscriptions_OrgId",
                schema: "listing",
                table: "ShortStayIcalSubscriptions",
                column: "OrgId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayIcalSubscriptions_UnitId",
                schema: "listing",
                table: "ShortStayIcalSubscriptions",
                column: "UnitId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayIcalOccurrences",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayIcalSubscriptions",
                schema: "listing");
        }
    }
}
