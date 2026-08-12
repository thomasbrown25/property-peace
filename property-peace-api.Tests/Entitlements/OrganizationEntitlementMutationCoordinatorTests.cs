using Xunit;
using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class OrganizationEntitlementMutationCoordinatorTests
{
    [Fact]
    public async Task Commits_only_successful_mutation_and_rolls_back_denial_error_and_cancellation()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options;
        await using var db = new DataContext(options);
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE quota_test (value INTEGER NOT NULL)");
        var coordinator = new EfOrganizationEntitlementMutationCoordinator(db);

        await coordinator.ExecuteAsync(10, async token =>
        {
            await db.Database.ExecuteSqlRawAsync("INSERT INTO quota_test VALUES (1)", token);
            return EntitlementMutationOutcome<int>.Commit(1);
        });
        Assert.Equal(1, await Count(db));

        await coordinator.ExecuteAsync(10, async token =>
        {
            await db.Database.ExecuteSqlRawAsync("INSERT INTO quota_test VALUES (2)", token);
            return EntitlementMutationOutcome<int>.Rollback(2);
        });
        Assert.Equal(1, await Count(db));

        await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.ExecuteAsync<int>(10, async token =>
        {
            await db.Database.ExecuteSqlRawAsync("INSERT INTO quota_test VALUES (3)", token);
            throw new InvalidOperationException("boom");
        }));
        Assert.Equal(1, await Count(db));

        await Assert.ThrowsAsync<OperationCanceledException>(() => coordinator.ExecuteAsync<int>(10, async token =>
        {
            await db.Database.ExecuteSqlRawAsync("INSERT INTO quota_test VALUES (4)", token);
            throw new OperationCanceledException(token);
        }));
        Assert.Equal(1, await Count(db));
    }

    private static Task<int> Count(DataContext db) =>
        db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM quota_test").SingleAsync();
}
