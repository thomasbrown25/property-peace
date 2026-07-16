using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsPrivateAndNullableTenantIdToTenantDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TenantDocuments_Tenants_TenantId",
                schema: "tenant",
                table: "TenantDocuments");

            migrationBuilder.AlterColumn<long>(
                name: "TenantId",
                schema: "tenant",
                table: "TenantDocuments",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<bool>(
                name: "IsPrivate",
                schema: "tenant",
                table: "TenantDocuments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddForeignKey(
                name: "FK_TenantDocuments_Tenants_TenantId",
                schema: "tenant",
                table: "TenantDocuments",
                column: "TenantId",
                principalSchema: "tenant",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TenantDocuments_Tenants_TenantId",
                schema: "tenant",
                table: "TenantDocuments");

            migrationBuilder.DropColumn(
                name: "IsPrivate",
                schema: "tenant",
                table: "TenantDocuments");

            migrationBuilder.AlterColumn<long>(
                name: "TenantId",
                schema: "tenant",
                table: "TenantDocuments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TenantDocuments_Tenants_TenantId",
                schema: "tenant",
                table: "TenantDocuments",
                column: "TenantId",
                principalSchema: "tenant",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
