using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationChecklistItemAndChecklistImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AfterMoveOutImagesBlobNames",
                table: "Checklists",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AfterMoveOutImagesUrls",
                table: "Checklists",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BeforeMoveInImagesBlobNames",
                table: "Checklists",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BeforeMoveInImagesUrls",
                table: "Checklists",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrganizationChecklistItems",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationChecklistItems_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationChecklistItems_OrganizationId",
                table: "OrganizationChecklistItems",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationChecklistItems_OrganizationId_IsDeleted",
                table: "OrganizationChecklistItems",
                columns: new[] { "OrganizationId", "IsDeleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationChecklistItems");

            migrationBuilder.DropColumn(
                name: "AfterMoveOutImagesBlobNames",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "AfterMoveOutImagesUrls",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "BeforeMoveInImagesBlobNames",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "BeforeMoveInImagesUrls",
                table: "Checklists");
        }
    }
}
