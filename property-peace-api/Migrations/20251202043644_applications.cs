using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class applications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PdfBlobName",
                table: "RentalApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfBlobUrl",
                table: "RentalApplications",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ApplicationInvites",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PropertyId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    InviteToken = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ApplicantName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsUsed = table.Column<bool>(type: "bit", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApplicationId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApplicationInvites_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApplicationInvites_RentalApplications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "RentalApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ApplicationInvites_Units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ApplicationInvites_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_ApplicationId",
                table: "ApplicationInvites",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_CreatedBy",
                table: "ApplicationInvites",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_Email",
                table: "ApplicationInvites",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_InviteToken",
                table: "ApplicationInvites",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_IsUsed",
                table: "ApplicationInvites",
                column: "IsUsed");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_PropertyId",
                table: "ApplicationInvites",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_ApplicationInvites_UnitId",
                table: "ApplicationInvites",
                column: "UnitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApplicationInvites");

            migrationBuilder.DropColumn(
                name: "PdfBlobName",
                table: "RentalApplications");

            migrationBuilder.DropColumn(
                name: "PdfBlobUrl",
                table: "RentalApplications");
        }
    }
}
