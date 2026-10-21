using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddShortStayGuidebookDraft : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShortStayGuidebookDrafts",
                schema: "listing",
                columns: table => new
                {
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    HouseRules = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ArrivalOverview = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    LocalNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortStayGuidebookDrafts", x => x.UnitId);
                    table.CheckConstraint("CK_ShortStayGuidebookDrafts_UnitId", "[UnitId] > 0");
                    table.ForeignKey(
                        name: "FK_ShortStayGuidebookDrafts_Units_UnitId",
                        column: x => x.UnitId,
                        principalSchema: "property",
                        principalTable: "Units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortStayGuidebookDrafts",
                schema: "listing");
        }
    }
}
