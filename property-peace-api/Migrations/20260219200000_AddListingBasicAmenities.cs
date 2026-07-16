using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingBasicAmenities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingBasicAmenities",
                schema: "listing",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    BasicAmenityId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingBasicAmenities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingBasicAmenities_Listings_ListingId",
                        column: x => x.ListingId,
                        principalSchema: "listing",
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ListingBasicAmenities_BasicAmenities_BasicAmenityId",
                        column: x => x.BasicAmenityId,
                        principalSchema: "listing",
                        principalTable: "BasicAmenities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingBasicAmenities_ListingId",
                schema: "listing",
                table: "ListingBasicAmenities",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingBasicAmenities_BasicAmenityId",
                schema: "listing",
                table: "ListingBasicAmenities",
                column: "BasicAmenityId");

            // Migrate existing basic amenity selections from ListingAmenities to ListingBasicAmenities
            migrationBuilder.Sql(@"
                INSERT INTO listing.ListingBasicAmenities (ListingId, BasicAmenityId)
                SELECT ListingId, BasicAmenityId
                FROM listing.ListingAmenities
                WHERE BasicAmenityId IS NOT NULL
            ");

            // Drop FK and column BasicAmenityId from ListingAmenities
            migrationBuilder.DropForeignKey(
                name: "FK_ListingAmenities_BasicAmenities_BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities");

            migrationBuilder.DropIndex(
                name: "IX_ListingAmenities_BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities");

            migrationBuilder.DropColumn(
                name: "BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ListingAmenities_BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities",
                column: "BasicAmenityId");

            migrationBuilder.AddForeignKey(
                name: "FK_ListingAmenities_BasicAmenities_BasicAmenityId",
                schema: "listing",
                table: "ListingAmenities",
                column: "BasicAmenityId",
                principalSchema: "listing",
                principalTable: "BasicAmenities",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            // Copy data back from ListingBasicAmenities to ListingAmenities
            migrationBuilder.Sql(@"
                INSERT INTO listing.ListingAmenities (ListingId, BasicAmenityId, IsAcquired)
                SELECT ListingId, BasicAmenityId, 1
                FROM listing.ListingBasicAmenities
            ");

            migrationBuilder.DropTable(
                name: "ListingBasicAmenities",
                schema: "listing");
        }
    }
}
