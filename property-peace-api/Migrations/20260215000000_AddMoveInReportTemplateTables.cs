using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMoveInReportTemplateTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "checklist");

            migrationBuilder.CreateTable(
                name: "OrganizationMoveInReportTemplates",
                schema: "checklist",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationMoveInReportTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationMoveInReportTemplates_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationReportSpaces",
                schema: "checklist",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TemplateId = table.Column<long>(type: "bigint", nullable: false),
                    SpaceLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CustomName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationReportSpaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationReportSpaces_OrganizationMoveInReportTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "checklist",
                        principalTable: "OrganizationMoveInReportTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationReportSpaceItems",
                schema: "checklist",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SpaceId = table.Column<long>(type: "bigint", nullable: false),
                    ItemName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationReportSpaceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationReportSpaceItems_OrganizationReportSpaces_SpaceId",
                        column: x => x.SpaceId,
                        principalSchema: "checklist",
                        principalTable: "OrganizationReportSpaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMoveInReportTemplates_OrganizationId",
                schema: "checklist",
                table: "OrganizationMoveInReportTemplates",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationReportSpaces_TemplateId",
                schema: "checklist",
                table: "OrganizationReportSpaces",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationReportSpaceItems_SpaceId",
                schema: "checklist",
                table: "OrganizationReportSpaceItems",
                column: "SpaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationReportSpaceItems",
                schema: "checklist");

            migrationBuilder.DropTable(
                name: "OrganizationReportSpaces",
                schema: "checklist");

            migrationBuilder.DropTable(
                name: "OrganizationMoveInReportTemplates",
                schema: "checklist");
        }
    }
}
