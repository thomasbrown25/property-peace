using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace brownstone_hub_api.Migrations;

[DbContext(typeof(DataContext))]
[Migration("20261127130000_AddWrenConversationProperty")]
public sealed class AddWrenConversationProperty : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<long>(
            name: "PropertyId", schema: "percy", table: "Conversations", type: "bigint", nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "PropertyId", schema: "percy", table: "Conversations");
}
