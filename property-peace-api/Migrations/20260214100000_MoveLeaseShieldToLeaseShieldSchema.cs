using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class MoveLeaseShieldToLeaseShieldSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'lease_shield')
    EXEC('CREATE SCHEMA lease_shield');
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'leaseshield' AND t.name = 'Conversations')
    ALTER SCHEMA lease_shield TRANSFER leaseshield.Conversations;
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'leaseshield' AND t.name = 'Messages')
    ALTER SCHEMA lease_shield TRANSFER leaseshield.Messages;
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'leaseshield' AND t.name = 'StateLawSources')
    ALTER SCHEMA lease_shield TRANSFER leaseshield.StateLawSources;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease_shield' AND t.name = 'StateLawSources')
    ALTER SCHEMA leaseshield TRANSFER lease_shield.StateLawSources;
");
            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease_shield' AND t.name = 'Messages')
    ALTER SCHEMA leaseshield TRANSFER lease_shield.Messages;
");
            migrationBuilder.Sql(@"
IF EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease_shield' AND t.name = 'Conversations')
    ALTER SCHEMA leaseshield TRANSFER lease_shield.Conversations;
");
        }
    }
}
