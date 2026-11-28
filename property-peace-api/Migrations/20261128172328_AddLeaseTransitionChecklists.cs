using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseTransitionChecklists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RequestId",
                schema: "checklist",
                table: "Checklists",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeaseTransitionChecklists",
                schema: "checklist",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    LandlordId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    LeaseId = table.Column<long>(type: "bigint", nullable: true),
                    Phase = table.Column<int>(type: "int", nullable: false),
                    RequestId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ConditionReportId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseTransitionChecklists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Checklists_ConditionReportId",
                        column: x => x.ConditionReportId,
                        principalSchema: "checklist",
                        principalTable: "Checklists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Leases_LeaseId",
                        column: x => x.LeaseId,
                        principalSchema: "lease",
                        principalTable: "Leases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklists_Users_LandlordId",
                        column: x => x.LandlordId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeaseTransitionChecklistItems",
                schema: "checklist",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeaseTransitionChecklistId = table.Column<long>(type: "bigint", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    AllowNotApplicable = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    NotApplicableReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseTransitionChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaseTransitionChecklistItems_LeaseTransitionChecklists_LeaseTransitionChecklistId",
                        column: x => x.LeaseTransitionChecklistId,
                        principalSchema: "checklist",
                        principalTable: "LeaseTransitionChecklists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklistItems_LeaseTransitionChecklistId_Key",
                schema: "checklist",
                table: "LeaseTransitionChecklistItems",
                columns: new[] { "LeaseTransitionChecklistId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_OrganizationId_LandlordId_RequestId",
                schema: "checklist",
                table: "Checklists",
                columns: new[] { "OrganizationId", "LandlordId", "RequestId" },
                unique: true,
                filter: "[RequestId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_ConditionReportId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                column: "ConditionReportId",
                unique: true,
                filter: "[ConditionReportId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_LandlordId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                column: "LandlordId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_LeaseId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_OrganizationId_LeaseId_Phase",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                columns: new[] { "OrganizationId", "LeaseId", "Phase" },
                unique: true,
                filter: "[LeaseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_OrganizationId_RequestId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                columns: new[] { "OrganizationId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_PropertyId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseTransitionChecklists_UnitId",
                schema: "checklist",
                table: "LeaseTransitionChecklists",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeaseTransitionChecklistItems",
                schema: "checklist");

            migrationBuilder.DropTable(
                name: "LeaseTransitionChecklists",
                schema: "checklist");

            migrationBuilder.DropIndex(
                name: "IX_Checklists_OrganizationId_LandlordId_RequestId",
                schema: "checklist",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "RequestId",
                schema: "checklist",
                table: "Checklists");
        }
    }
}
