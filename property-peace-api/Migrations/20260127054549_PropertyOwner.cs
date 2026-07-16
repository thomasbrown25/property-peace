using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class PropertyOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "PropertyOwnerId",
                table: "Properties",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PropertyOwners",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    FirstName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CompanyName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    ManagementFeePercentage = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    ManagementFeeFlat = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    StatementFrequency = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertyOwners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyOwners_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PropertyOwners_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "OwnerInvites",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyOwnerId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: true),
                    InviteToken = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsUsed = table.Column<bool>(type: "bit", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OwnerInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OwnerInvites_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_OwnerInvites_PropertyOwners_PropertyOwnerId",
                        column: x => x.PropertyOwnerId,
                        principalTable: "PropertyOwners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OwnerInvites_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Properties_PropertyOwnerId",
                table: "Properties",
                column: "PropertyOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvites_CreatedBy",
                table: "OwnerInvites",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvites_Email",
                table: "OwnerInvites",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvites_InviteToken",
                table: "OwnerInvites",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvites_OrganizationId",
                table: "OwnerInvites",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OwnerInvites_PropertyOwnerId",
                table: "OwnerInvites",
                column: "PropertyOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyOwners_Email",
                table: "PropertyOwners",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyOwners_OrganizationId",
                table: "PropertyOwners",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyOwners_OrganizationId_Email",
                table: "PropertyOwners",
                columns: new[] { "OrganizationId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_PropertyOwners_UserId",
                table: "PropertyOwners",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Properties_PropertyOwners_PropertyOwnerId",
                table: "Properties",
                column: "PropertyOwnerId",
                principalTable: "PropertyOwners",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Properties_PropertyOwners_PropertyOwnerId",
                table: "Properties");

            migrationBuilder.DropTable(
                name: "OwnerInvites");

            migrationBuilder.DropTable(
                name: "PropertyOwners");

            migrationBuilder.DropIndex(
                name: "IX_Properties_PropertyOwnerId",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "PropertyOwnerId",
                table: "Properties");
        }
    }
}
