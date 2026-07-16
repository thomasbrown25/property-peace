using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class SyncModelWithSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ensure all AutoRenew columns exist (AddAutoRenewToLease may not have been applied to this DB).
            var ensureAutoRenewColumns = @"
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease' AND t.name = 'Leases' AND c.name = 'AutoRenewLease')
    ALTER TABLE [lease].[Leases] ADD [AutoRenewLease] bit NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease' AND t.name = 'Leases' AND c.name = 'AutoRenewRentIncrement')
    ALTER TABLE [lease].[Leases] ADD [AutoRenewRentIncrement] bit NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease' AND t.name = 'Leases' AND c.name = 'AutoRenewRentIncrementType')
    ALTER TABLE [lease].[Leases] ADD [AutoRenewRentIncrementType] nvarchar(max) NULL;
ELSE
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name] FROM [sys].[default_constraints] [d] INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[lease].[Leases]') AND [c].[name] = N'AutoRenewRentIncrementType');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [lease].[Leases] DROP CONSTRAINT [' + @var + '];');
    ALTER TABLE [lease].[Leases] ALTER COLUMN [AutoRenewRentIncrementType] nvarchar(max) NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'lease' AND t.name = 'Leases' AND c.name = 'AutoRenewRentIncrementValue')
    ALTER TABLE [lease].[Leases] ADD [AutoRenewRentIncrementValue] decimal(18,2) NULL;
";
            migrationBuilder.Sql(ensureAutoRenewColumns);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'lease' AND t.name = 'Leases' AND c.name = 'AutoRenewRentIncrementType'
)
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[lease].[Leases]') AND [c].[name] = N'AutoRenewRentIncrementType');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [lease].[Leases] DROP CONSTRAINT [' + @var + '];');
    ALTER TABLE [lease].[Leases] ALTER COLUMN [AutoRenewRentIncrementType] nvarchar(20) NULL;
END");
        }
    }
}
