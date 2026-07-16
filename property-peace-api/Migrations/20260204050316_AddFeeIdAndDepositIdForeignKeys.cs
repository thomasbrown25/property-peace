using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddFeeIdAndDepositIdForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop existing foreign keys if they exist (with wrong delete action)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Payments_LeaseFees_FeeId')
                BEGIN
                    ALTER TABLE [Payments] DROP CONSTRAINT [FK_Payments_LeaseFees_FeeId];
                END
            ");
            
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Payments_Deposits_DepositId')
                BEGIN
                    ALTER TABLE [Payments] DROP CONSTRAINT [FK_Payments_Deposits_DepositId];
                END
            ");
            
            // Add columns if they don't exist (from previous failed migration)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'FeeId')
                BEGIN
                    ALTER TABLE [Payments] ADD [FeeId] bigint NULL;
                END
            ");
            
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Payments') AND name = 'DepositId')
                BEGIN
                    ALTER TABLE [Payments] ADD [DepositId] bigint NULL;
                END
            ");
            
            // Create indexes if they don't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_FeeId' AND object_id = OBJECT_ID('Payments'))
                BEGIN
                    CREATE INDEX [IX_Payments_FeeId] ON [Payments] ([FeeId]);
                END
            ");
            
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Payments_DepositId' AND object_id = OBJECT_ID('Payments'))
                BEGIN
                    CREATE INDEX [IX_Payments_DepositId] ON [Payments] ([DepositId]);
                END
            ");
            
            // Add foreign keys with NoAction (to avoid cascade path issues)
            migrationBuilder.AddForeignKey(
                name: "FK_Payments_LeaseFees_FeeId",
                table: "Payments",
                column: "FeeId",
                principalTable: "LeaseFees",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
            
            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Deposits_DepositId",
                table: "Payments",
                column: "DepositId",
                principalTable: "Deposits",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Deposits_DepositId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_LeaseFees_FeeId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_DepositId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_FeeId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "DepositId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "FeeId",
                table: "Payments");
        }
    }
}
