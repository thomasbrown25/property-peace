using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddOperatingAccountIdToProperty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "OperatingAccountId",
                table: "Properties",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Properties_OperatingAccountId",
                table: "Properties",
                column: "OperatingAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Properties_BankAccounts_OperatingAccountId",
                table: "Properties",
                column: "OperatingAccountId",
                principalTable: "BankAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Properties_BankAccounts_OperatingAccountId",
                table: "Properties");

            migrationBuilder.DropIndex(
                name: "IX_Properties_OperatingAccountId",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "OperatingAccountId",
                table: "Properties");
        }
    }
}

