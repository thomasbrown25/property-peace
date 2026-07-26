using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeaseFinalizationIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LeaseInstances_LeaseId",
                schema: "lease_builder",
                table: "LeaseInstances");

            migrationBuilder.DropIndex(
                name: "IX_LeaseInstances_LeaseId_IsFinalized",
                schema: "lease_builder",
                table: "LeaseInstances");

            migrationBuilder.DropIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId_DocumentType",
                schema: "lease_builder",
                table: "LeaseDocuments");

            // Existing data may predate these uniqueness guarantees. Clean it deterministically
            // before creating indexes so deployment does not fail on historical duplicates.
            migrationBuilder.Sql(
                """
                ;WITH [RankedFinalized] AS
                (
                    SELECT [Id], ROW_NUMBER() OVER
                    (
                        PARTITION BY [LeaseId]
                        ORDER BY [FinalizedAt] DESC, [Id] DESC
                    ) AS [DuplicateRank]
                    FROM [lease_builder].[LeaseInstances]
                    WHERE [IsFinalized] = 1
                )
                UPDATE [li]
                SET [IsFinalized] = 0, [IsDraft] = 1, [FinalizedAt] = NULL
                FROM [lease_builder].[LeaseInstances] AS [li]
                INNER JOIN [RankedFinalized] AS [ranked] ON [ranked].[Id] = [li].[Id]
                WHERE [ranked].[DuplicateRank] > 1;

                ;WITH [RankedLeaseDocuments] AS
                (
                    SELECT [Id], ROW_NUMBER() OVER
                    (
                        PARTITION BY [LeaseInstanceId], [DocumentType]
                        ORDER BY [GeneratedAt] DESC, [Id] DESC
                    ) AS [DuplicateRank]
                    FROM [lease_builder].[LeaseDocuments]
                )
                DELETE [ld]
                FROM [lease_builder].[LeaseDocuments] AS [ld]
                INNER JOIN [RankedLeaseDocuments] AS [ranked] ON [ranked].[Id] = [ld].[Id]
                WHERE [ranked].[DuplicateRank] > 1;

                ;WITH [RankedActiveTenantDocuments] AS
                (
                    SELECT [Id], ROW_NUMBER() OVER
                    (
                        PARTITION BY [TenantId], [LeaseId], [DocumentType]
                        ORDER BY [CreatedAt] DESC, [Id] DESC
                    ) AS [DuplicateRank]
                    FROM [tenant].[TenantDocuments]
                    WHERE [IsDeleted] = 0
                      AND [TenantId] IS NOT NULL
                      AND [LeaseId] IS NOT NULL
                )
                UPDATE [td]
                SET [IsDeleted] = 1,
                    [DeletedAt] = COALESCE([td].[DeletedAt], SYSUTCDATETIME())
                FROM [tenant].[TenantDocuments] AS [td]
                INNER JOIN [RankedActiveTenantDocuments] AS [ranked] ON [ranked].[Id] = [td].[Id]
                WHERE [ranked].[DuplicateRank] > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "UX_TenantDocuments_ActiveTenantLeaseType",
                schema: "tenant",
                table: "TenantDocuments",
                columns: new[] { "TenantId", "LeaseId", "DocumentType" },
                unique: true,
                filter: "[IsDeleted] = 0 AND [TenantId] IS NOT NULL AND [LeaseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_LeaseInstances_LeaseId_Finalized",
                schema: "lease_builder",
                table: "LeaseInstances",
                column: "LeaseId",
                unique: true,
                filter: "[IsFinalized] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId_DocumentType",
                schema: "lease_builder",
                table: "LeaseDocuments",
                columns: new[] { "LeaseInstanceId", "DocumentType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_TenantDocuments_ActiveTenantLeaseType",
                schema: "tenant",
                table: "TenantDocuments");

            migrationBuilder.DropIndex(
                name: "UX_LeaseInstances_LeaseId_Finalized",
                schema: "lease_builder",
                table: "LeaseInstances");

            migrationBuilder.DropIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId_DocumentType",
                schema: "lease_builder",
                table: "LeaseDocuments");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_LeaseId",
                schema: "lease_builder",
                table: "LeaseInstances",
                column: "LeaseId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseInstances_LeaseId_IsFinalized",
                schema: "lease_builder",
                table: "LeaseInstances",
                columns: new[] { "LeaseId", "IsFinalized" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseDocuments_LeaseInstanceId_DocumentType",
                schema: "lease_builder",
                table: "LeaseDocuments",
                columns: new[] { "LeaseInstanceId", "DocumentType" });
        }
    }
}
