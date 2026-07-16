using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddStateLawSources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StateLawSources",
                schema: "admin",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    State = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    LateFeeUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityDepositUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StateLawSources", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StateLawSources_State",
                schema: "admin",
                table: "StateLawSources",
                column: "State",
                unique: true);

            // Seed initial curated URLs (from previous JSON config)
            var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.fff");
            migrationBuilder.Sql($@"
INSERT INTO admin.StateLawSources (State, LateFeeUrl, SecurityDepositUrl, UpdatedAt) VALUES
('NC', 'https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42', 'https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42', '{now}'),
('CA', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.3', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5', '{now}'),
('TX', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm', '{now}'),
('FL', 'https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html', 'https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html', '{now}'),
('KS', 'https://kslegislature.gov/li_2024/b2023_24/statute/058_000_0000_chapter/058_008_0000_article/058_008_0016a_section/058_008_0016a_k/', 'https://kslegislature.gov/li_2024/b2023_24/statute/058_000_0000_chapter/058_008_0000_article/', '{now}');
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StateLawSources",
                schema: "admin");
        }
    }
}
