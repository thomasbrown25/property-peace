using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddStorageObjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StorageObjects",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    UploadedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    OwnerUserId = table.Column<long>(type: "bigint", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    EntityId = table.Column<long>(type: "bigint", nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    BlobContainer = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    BlobName = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: false),
                    BlobUrl = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorageObjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StorageObjects_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StorageObjects_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StorageObjects_Users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_BlobContainer_BlobName",
                table: "StorageObjects",
                columns: new[] { "BlobContainer", "BlobName" });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_Category_CreatedAt",
                table: "StorageObjects",
                columns: new[] { "Category", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_CreatedAt",
                table: "StorageObjects",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_EntityType_EntityId",
                table: "StorageObjects",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_OrganizationId_CreatedAt",
                table: "StorageObjects",
                columns: new[] { "OrganizationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_OwnerUserId_CreatedAt",
                table: "StorageObjects",
                columns: new[] { "OwnerUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StorageObjects_UploadedByUserId_CreatedAt",
                table: "StorageObjects",
                columns: new[] { "UploadedByUserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StorageObjects");
        }
    }
}
