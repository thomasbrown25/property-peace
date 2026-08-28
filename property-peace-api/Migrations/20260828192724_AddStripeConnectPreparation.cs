using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeConnectPreparation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StripeConnectPreparations",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    OrganizationId = table.Column<long>(type: "bigint", nullable: false),
                    OperatingType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AuthorityRelationship = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    AuthorityAttested = table.Column<bool>(type: "bit", nullable: false),
                    AuthorityAttestedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeConnectPreparations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StripeConnectPreparations_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalSchema: "organization",
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StripeConnectPreparations_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "core",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StripeConnectPreparationProperties",
                schema: "financial",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StripeConnectPreparationId = table.Column<long>(type: "bigint", nullable: false),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeConnectPreparationProperties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StripeConnectPreparationProperties_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalSchema: "property",
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StripeConnectPreparationProperties_StripeConnectPreparations_StripeConnectPreparationId",
                        column: x => x.StripeConnectPreparationId,
                        principalSchema: "financial",
                        principalTable: "StripeConnectPreparations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectPreparationProperties_PropertyId",
                schema: "financial",
                table: "StripeConnectPreparationProperties",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectPreparationProperties_StripeConnectPreparationId_PropertyId",
                schema: "financial",
                table: "StripeConnectPreparationProperties",
                columns: new[] { "StripeConnectPreparationId", "PropertyId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectPreparations_OrganizationId_UpdatedAt",
                schema: "financial",
                table: "StripeConnectPreparations",
                columns: new[] { "OrganizationId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StripeConnectPreparations_UserId_OrganizationId",
                schema: "financial",
                table: "StripeConnectPreparations",
                columns: new[] { "UserId", "OrganizationId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StripeConnectPreparationProperties",
                schema: "financial");

            migrationBuilder.DropTable(
                name: "StripeConnectPreparations",
                schema: "financial");
        }
    }
}
