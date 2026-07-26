using brownstone_hub_api.Migrations;
using FluentAssertions;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Migrations;

public class AddLeaseFinalizationIdempotencyMigrationTests
{
    [Fact]
    public void Up_CleansDuplicatesBeforeCreatingUniqueIndexes()
    {
        var operations = new TestableMigration().BuildUpOperations();
        var sqlIndex = operations.FindIndex(operation => operation is SqlOperation);
        var firstUniqueIndex = operations.FindIndex(operation =>
            operation is CreateIndexOperation index && index.IsUnique);

        sqlIndex.Should().BeGreaterThanOrEqualTo(0);
        firstUniqueIndex.Should().BeGreaterThan(sqlIndex);

        var sql = ((SqlOperation)operations[sqlIndex]).Sql;
        sql.Should().Contain("PARTITION BY [LeaseId]");
        sql.Should().Contain("ORDER BY [FinalizedAt] DESC, [Id] DESC");
        sql.Should().Contain("SET [IsFinalized] = 0, [IsDraft] = 1, [FinalizedAt] = NULL");
        sql.Should().Contain("PARTITION BY [LeaseInstanceId], [DocumentType]");
        sql.Should().Contain("ORDER BY [GeneratedAt] DESC, [Id] DESC");
        sql.Should().Contain("DELETE [ld]");
        sql.Should().Contain("PARTITION BY [TenantId], [LeaseId], [DocumentType]");
        sql.Should().Contain("ORDER BY [CreatedAt] DESC, [Id] DESC");
        sql.Should().Contain("SET [IsDeleted] = 1");
        sql.Should().Contain("[tenant].[TenantDocuments]");
    }

    private sealed class TestableMigration : AddLeaseFinalizationIdempotency
    {
        public List<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }
    }
}
