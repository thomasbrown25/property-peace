using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyListings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BasicAmenities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BasicAmenities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomAmenities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAmenities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomAmenities_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CustomAmenities_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "DefaultAmenities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DefaultAmenities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Listings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    ListingNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SquareFeet = table.Column<int>(type: "int", nullable: true),
                    MonthlyRent = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SecurityDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    YearBuilt = table.Column<int>(type: "int", nullable: true),
                    DateAvailable = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MinLeaseDuration = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaxLeaseDuration = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PetsAllowed = table.Column<bool>(type: "bit", nullable: false),
                    MarketingDescription = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    VideoTourUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AcceptOnlineApplications = table.Column<bool>(type: "bit", nullable: false),
                    ApplicationFeeRequired = table.Column<bool>(type: "bit", nullable: false),
                    ApplicationFee = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RequireScreening = table.Column<bool>(type: "bit", nullable: false),
                    ScreeningType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RequireIncomeVerification = table.Column<bool>(type: "bit", nullable: false),
                    IncomeVerificationCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ListingContactId = table.Column<long>(type: "bigint", nullable: true),
                    ListingContactName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ListingContactPhone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ListingContactEmail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SyndicateToListingWebsite = table.Column<bool>(type: "bit", nullable: false),
                    SyndicateToFreeSites = table.Column<bool>(type: "bit", nullable: false),
                    SyndicateToPremiumSites = table.Column<bool>(type: "bit", nullable: false),
                    CustomListingUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Listings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Listings_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Listings_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Listings_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Listings_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Listings_Users_ListingContactId",
                        column: x => x.ListingContactId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ListingAmenities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    BasicAmenityId = table.Column<long>(type: "bigint", nullable: true),
                    DefaultAmenityId = table.Column<long>(type: "bigint", nullable: true),
                    CustomAmenityId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingAmenities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingAmenities_BasicAmenities_BasicAmenityId",
                        column: x => x.BasicAmenityId,
                        principalTable: "BasicAmenities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListingAmenities_CustomAmenities_CustomAmenityId",
                        column: x => x.CustomAmenityId,
                        principalTable: "CustomAmenities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListingAmenities_DefaultAmenities_DefaultAmenityId",
                        column: x => x.DefaultAmenityId,
                        principalTable: "DefaultAmenities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListingAmenities_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ListingFeatures",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListingId = table.Column<long>(type: "bigint", nullable: false),
                    DefaultAmenityId = table.Column<long>(type: "bigint", nullable: true),
                    CustomAmenityId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingFeatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingFeatures_CustomAmenities_CustomAmenityId",
                        column: x => x.CustomAmenityId,
                        principalTable: "CustomAmenities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListingFeatures_DefaultAmenities_DefaultAmenityId",
                        column: x => x.DefaultAmenityId,
                        principalTable: "DefaultAmenities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListingFeatures_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ListingImages",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BlobName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BlobUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RefId = table.Column<long>(type: "bigint", nullable: false),
                    IsCoverPhoto = table.Column<bool>(type: "bit", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingImages_Listings_RefId",
                        column: x => x.RefId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BasicAmenities_Category",
                table: "BasicAmenities",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAmenities_Category",
                table: "CustomAmenities",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAmenities_CreatedBy",
                table: "CustomAmenities",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAmenities_OrganizationId",
                table: "CustomAmenities",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_DefaultAmenities_Category",
                table: "DefaultAmenities",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ListingAmenities_BasicAmenityId",
                table: "ListingAmenities",
                column: "BasicAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingAmenities_CustomAmenityId",
                table: "ListingAmenities",
                column: "CustomAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingAmenities_DefaultAmenityId",
                table: "ListingAmenities",
                column: "DefaultAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingAmenities_ListingId",
                table: "ListingAmenities",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingFeatures_CustomAmenityId",
                table: "ListingFeatures",
                column: "CustomAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingFeatures_DefaultAmenityId",
                table: "ListingFeatures",
                column: "DefaultAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingFeatures_ListingId",
                table: "ListingFeatures",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingImages_IsCoverPhoto",
                table: "ListingImages",
                column: "IsCoverPhoto");

            migrationBuilder.CreateIndex(
                name: "IX_ListingImages_RefId",
                table: "ListingImages",
                column: "RefId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_CreatedBy",
                table: "Listings",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_ListingContactId",
                table: "Listings",
                column: "ListingContactId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_ListingNumber",
                table: "Listings",
                column: "ListingNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Listings_OrganizationId",
                table: "Listings",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_PropertyId",
                table: "Listings",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_Status",
                table: "Listings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_UnitId",
                table: "Listings",
                column: "UnitId");

            // Seed BasicAmenities
            migrationBuilder.InsertData(
                table: "BasicAmenities",
                columns: new[] { "Name", "Category" },
                values: new object[,]
                {
                    // Parking options
                    { "Dedicated Spot", "Parking" },
                    { "Driveway", "Parking" },
                    { "Garage", "Parking" },
                    { "On-street", "Parking" },
                    { "Private Lot", "Parking" },
                    { "Other", "Parking" },
                    { "None", "Parking" },
                    // Laundry options
                    { "In-unit", "Laundry" },
                    { "On-site", "Laundry" },
                    { "Hook-ups", "Laundry" },
                    { "Other", "Laundry" },
                    { "None", "Laundry" },
                    // Air Conditioning options
                    { "Central air", "AirConditioning" },
                    { "Window unit", "AirConditioning" },
                    { "Evaporative cooler", "AirConditioning" },
                    { "Other", "AirConditioning" },
                    { "None", "AirConditioning" }
                });

            // Seed DefaultAmenities - Property Amenities
            migrationBuilder.InsertData(
                table: "DefaultAmenities",
                columns: new[] { "Name", "Category" },
                values: new object[,]
                {
                    { "Basketball court", "PropertyAmenity" },
                    { "BBQ", "PropertyAmenity" },
                    { "Business center", "PropertyAmenity" },
                    { "Clubhouse", "PropertyAmenity" },
                    { "Dog park", "PropertyAmenity" },
                    { "Elevator", "PropertyAmenity" },
                    { "Fire pits", "PropertyAmenity" },
                    { "Fitness center", "PropertyAmenity" },
                    { "Game room", "PropertyAmenity" },
                    { "Hot tub", "PropertyAmenity" },
                    { "Near park", "PropertyAmenity" },
                    { "On-site laundry", "PropertyAmenity" },
                    { "Pet washing station", "PropertyAmenity" },
                    { "Playground", "PropertyAmenity" },
                    { "Pool", "PropertyAmenity" },
                    { "Tennis court", "PropertyAmenity" },
                    { "Theater room", "PropertyAmenity" },
                    { "Volleyball court", "PropertyAmenity" }
                });

            // Seed DefaultAmenities - Property Features
            migrationBuilder.InsertData(
                table: "DefaultAmenities",
                columns: new[] { "Name", "Category" },
                values: new object[,]
                {
                    { "Alarm", "PropertyFeature" },
                    { "Furnished", "PropertyFeature" },
                    { "Renovated", "PropertyFeature" },
                    { "Hardwood floors", "PropertyFeature" },
                    { "Fireplace", "PropertyFeature" },
                    { "Fresh paint", "PropertyFeature" },
                    { "Dishwasher", "PropertyFeature" },
                    { "Walk-in closets", "PropertyFeature" },
                    { "Balcony, Deck, Patio", "PropertyFeature" },
                    { "Internet", "PropertyFeature" },
                    { "Fenced yard", "PropertyFeature" },
                    { "Tile", "PropertyFeature" },
                    { "Carpet", "PropertyFeature" },
                    { "Storage", "PropertyFeature" },
                    { "Unfurnished", "PropertyFeature" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingAmenities");

            migrationBuilder.DropTable(
                name: "ListingFeatures");

            migrationBuilder.DropTable(
                name: "ListingImages");

            migrationBuilder.DropTable(
                name: "BasicAmenities");

            migrationBuilder.DropTable(
                name: "CustomAmenities");

            migrationBuilder.DropTable(
                name: "DefaultAmenities");

            migrationBuilder.DropTable(
                name: "Listings");
        }
    }
}
