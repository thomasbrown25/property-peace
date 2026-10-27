using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20261020000000_AddExpoPushTokens")]
public sealed class AddExpoPushTokens : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ExpoPushTokens", schema: "communication",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                UserId = table.Column<long>(type: "bigint", nullable: false),
                Token = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ExpoPushTokens", x => x.Id);
                table.ForeignKey("FK_ExpoPushTokens_Users_UserId", x => x.UserId,
                    principalSchema: "core", principalTable: "Users", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_ExpoPushTokens_Token", schema: "communication", table: "ExpoPushTokens", column: "Token", unique: true);
        migrationBuilder.CreateIndex(name: "IX_ExpoPushTokens_UserId", schema: "communication", table: "ExpoPushTokens", column: "UserId");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "ExpoPushTokens", schema: "communication");
}
