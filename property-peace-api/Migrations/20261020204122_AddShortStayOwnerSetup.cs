using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayOwnerSetup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                schema: "property",
                table: "Properties",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShortStayBlocks",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayBlocks", x => x.Id);
                    table.CheckConstraint("CK_ShortStayBlocks_DateRange", "[EndDate] > [StartDate]");
                    table.ForeignKey(
                        name: "FK_ShortStayBlocks_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayListings",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    NightlyBasePrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MinimumNights = table.Column<int>(type: "int", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    CleaningFee = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CheckInTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    CheckOutTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    HouseRules = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    Amenities = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    CancellationPolicy = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false, defaultValue: "Draft")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayListings", x => x.Id);
                    table.CheckConstraint("CK_ShortStayListings_Capacity", "[Capacity] >= 1");
                    table.CheckConstraint("CK_ShortStayListings_CleaningFee", "[CleaningFee] >= 0");
                    table.CheckConstraint("CK_ShortStayListings_MinimumNights", "[MinimumNights] >= 1");
                    table.CheckConstraint("CK_ShortStayListings_NightlyBasePrice", "[NightlyBasePrice] > 0");
                    table.CheckConstraint("CK_ShortStayListings_Status", "[Status] IN ('Draft', 'Published')");
                    table.ForeignKey(
                        name: "FK_ShortStayListings_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayNightlyRateOverrides",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    NightlyRate = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayNightlyRateOverrides", x => x.Id);
                    table.CheckConstraint("CK_ShortStayNightlyRateOverrides_NightlyRate", "[NightlyRate] > 0");
                    table.ForeignKey(
                        name: "FK_ShortStayNightlyRateOverrides_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShortStayListingPhotos",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShortStayListingId = table.Column<long>(type: "bigint", nullable: false),
                    BlobName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    IsCoverPhoto = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayListingPhotos", x => x.Id);
                    table.CheckConstraint("CK_ShortStayListingPhotos_BlobName", "[BlobName] <> ''");
                    table.CheckConstraint("CK_ShortStayListingPhotos_DisplayOrder", "[DisplayOrder] >= 0");
                    table.ForeignKey(
                        name: "FK_ShortStayListingPhotos_ShortStayListings_ShortStayListingId",
                        column: x => x.ShortStayListingId,
                        principalSchema: "listing",
                        principalTable: "ShortStayListings",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayBlocks_UnitId_StartDate_EndDate",
                schema: "listing",
                table: "ShortStayBlocks",
                columns: new[] { "UnitId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayListingPhotos_BlobName",
                schema: "listing",
                table: "ShortStayListingPhotos",
                column: "BlobName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayListingPhotos_ShortStayListingId",
                schema: "listing",
                table: "ShortStayListingPhotos",
                column: "ShortStayListingId",
                unique: true,
                filter: "[IsCoverPhoto] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayListingPhotos_ShortStayListingId_DisplayOrder",
                schema: "listing",
                table: "ShortStayListingPhotos",
                columns: new[] { "ShortStayListingId", "DisplayOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayListings_UnitId",
                schema: "listing",
                table: "ShortStayListings",
                column: "UnitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortStayNightlyRateOverrides_UnitId_Date",
                schema: "listing",
                table: "ShortStayNightlyRateOverrides",
                columns: new[] { "UnitId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayBlocks",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayListingPhotos",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayNightlyRateOverrides",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "ShortStayListings",
                schema: "listing");

            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                schema: "property",
                table: "Properties");
        }
    }
}
