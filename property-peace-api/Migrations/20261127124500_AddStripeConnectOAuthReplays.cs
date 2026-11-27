using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace brownstone_hub_api.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20261127124500_AddStripeConnectOAuthReplays")]
public partial class AddStripeConnectOAuthReplays : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "StripeConnectOAuthReplays",
            schema: "financial",
            columns: table => new
            {
                CodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                StateNonceHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                ConsumedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_StripeConnectOAuthReplays", x => x.CodeHash));

        migrationBuilder.CreateIndex(
            name: "IX_StripeConnectOAuthReplays_ExpiresAt",
            schema: "financial",
            table: "StripeConnectOAuthReplays",
            column: "ExpiresAt");

        migrationBuilder.CreateIndex(
            name: "IX_StripeConnectOAuthReplays_StateNonceHash",
            schema: "financial",
            table: "StripeConnectOAuthReplays",
            column: "StateNonceHash",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(
        name: "StripeConnectOAuthReplays", schema: "financial");
}
