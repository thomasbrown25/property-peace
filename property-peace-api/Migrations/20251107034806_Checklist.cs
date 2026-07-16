using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class Checklist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Checklists",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChecklistType = table.Column<int>(type: "int", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    LeaseId = table.Column<long>(type: "bigint", nullable: true),
                    TenantId = table.Column<long>(type: "bigint", nullable: true),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    InspectionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    ConductedBy = table.Column<long>(type: "bigint", nullable: true),
                    TenantSignature = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LandlordSignature = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    TenantSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LandlordSignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    GeneralNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConditionNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LandlordId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Checklists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Checklists_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Checklists_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Checklists_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Checklists_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Checklists_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RentalApplications",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Status = table.Column<int>(type: "int", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    DateOfBirth = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Ssn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CurrentAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CurrentCity = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CurrentState = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CurrentZipCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EmployerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    JobTitle = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MonthlyIncome = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    EmploymentMonths = table.Column<int>(type: "int", nullable: true),
                    EmergencyContactName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EmergencyContactPhone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EmergencyContactRelationship = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PreviousLandlordName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PreviousLandlordPhone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NumberOfOccupants = table.Column<int>(type: "int", nullable: true),
                    HasPets = table.Column<bool>(type: "bit", nullable: false),
                    PetDetails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    HasVehicles = table.Column<bool>(type: "bit", nullable: false),
                    VehicleDetails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DesiredMoveInDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AdditionalNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ReviewNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReviewedBy = table.Column<long>(type: "bigint", nullable: true),
                    ConvertedToTenantId = table.Column<long>(type: "bigint", nullable: true),
                    ConvertedToLeaseId = table.Column<long>(type: "bigint", nullable: true),
                    LandlordId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: true),
                    UpdatedBy = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RentalApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RentalApplications_Leases_ConvertedToLeaseId",
                        column: x => x.ConvertedToLeaseId,
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RentalApplications_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RentalApplications_Tenants_ConvertedToTenantId",
                        column: x => x.ConvertedToTenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RentalApplications_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RentalApplications_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistItems",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Condition = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    HasDamage = table.Column<bool>(type: "bit", nullable: false),
                    DamageDescription = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PhotoBlobName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoBlobUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsChecked = table.Column<bool>(type: "bit", nullable: false),
                    CheckedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ChecklistId = table.Column<long>(type: "bigint", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistItems_Checklists_ChecklistId",
                        column: x => x.ChecklistId,
                        principalTable: "Checklists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistItems_ChecklistId",
                table: "ChecklistItems",
                column: "ChecklistId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistItems_ChecklistId_SortOrder",
                table: "ChecklistItems",
                columns: new[] { "ChecklistId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_ChecklistType",
                table: "Checklists",
                column: "ChecklistType");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_InspectionDate",
                table: "Checklists",
                column: "InspectionDate");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_LandlordId",
                table: "Checklists",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_LeaseId",
                table: "Checklists",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_PropertyId",
                table: "Checklists",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_PropertyId_ChecklistType",
                table: "Checklists",
                columns: new[] { "PropertyId", "ChecklistType" });

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_TenantId",
                table: "Checklists",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_UnitId",
                table: "Checklists",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_ConvertedToLeaseId",
                table: "RentalApplications",
                column: "ConvertedToLeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_ConvertedToTenantId",
                table: "RentalApplications",
                column: "ConvertedToTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_Email",
                table: "RentalApplications",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_LandlordId",
                table: "RentalApplications",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_LandlordId_Status",
                table: "RentalApplications",
                columns: new[] { "LandlordId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_PropertyId",
                table: "RentalApplications",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_Status",
                table: "RentalApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_SubmittedAt",
                table: "RentalApplications",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RentalApplications_UnitId",
                table: "RentalApplications",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChecklistItems");

            migrationBuilder.DropTable(
                name: "RentalApplications");

            migrationBuilder.DropTable(
                name: "Checklists");
        }
    }
}
