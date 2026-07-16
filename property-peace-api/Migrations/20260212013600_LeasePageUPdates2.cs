using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class LeasePageUPdates2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdditionalTerms",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AwareOfLeadPaint",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "BuiltBefore1978",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EarlyTerminationClauseText",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasLeadPaintRecords",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IncludeEarlyTerminationClause",
                schema: "lease",
                table: "Leases",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LeadPaintExplanation",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LeadPaintRecordsExplanation",
                schema: "lease",
                table: "Leases",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalTerms",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "AwareOfLeadPaint",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "BuiltBefore1978",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "EarlyTerminationClauseText",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "HasLeadPaintRecords",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "IncludeEarlyTerminationClause",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LeadPaintExplanation",
                schema: "lease",
                table: "Leases");

            migrationBuilder.DropColumn(
                name: "LeadPaintRecordsExplanation",
                schema: "lease",
                table: "Leases");
        }
    }
}
