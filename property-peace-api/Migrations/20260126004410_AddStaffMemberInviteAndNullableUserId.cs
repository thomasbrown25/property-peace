using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffMemberInviteAndNullableUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "UserId",
                table: "StaffMembers",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "StaffMembers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "StaffMembers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "StaffMembers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StaffMemberInvites",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StaffMemberId = table.Column<long>(type: "bigint", nullable: false),
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
                    table.PrimaryKey("PK_StaffMemberInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffMemberInvites_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StaffMemberInvites_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffMemberInvites_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_CreatedBy",
                table: "StaffMemberInvites",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_Email",
                table: "StaffMemberInvites",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_InviteToken",
                table: "StaffMemberInvites",
                column: "InviteToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_IsUsed",
                table: "StaffMemberInvites",
                column: "IsUsed");

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_OrganizationId",
                table: "StaffMemberInvites",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffMemberInvites_StaffMemberId",
                table: "StaffMemberInvites",
                column: "StaffMemberId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StaffMemberInvites");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "StaffMembers");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "StaffMembers");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "StaffMembers");

            migrationBuilder.AlterColumn<long>(
                name: "UserId",
                table: "StaffMembers",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
