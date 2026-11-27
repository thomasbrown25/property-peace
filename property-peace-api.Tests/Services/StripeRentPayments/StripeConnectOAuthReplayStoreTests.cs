using brownstone_hub_api.Data;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectOAuthReplayStoreTests
{
    [Fact]
    public async Task TryConsumeAsync_AllowsTheFirstResponse_AndRejectsItsCodeOrStateOnSubsequentRequests()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options;
        // The rest of the application model has SQL Server-specific DDL.
        await using (var setup = new DataContext(options))
            await setup.Database.ExecuteSqlRawAsync("""
                CREATE TABLE StripeConnectOAuthReplays (
                    CodeHash TEXT NOT NULL PRIMARY KEY,
                    StateNonceHash TEXT NOT NULL UNIQUE,
                    ConsumedAt TEXT NOT NULL,
                    ExpiresAt TEXT NOT NULL
                )
                """);

        await using var firstDb = new DataContext(options);
        var first = new StripeConnectOAuthReplayStore(firstDb, TimeProvider.System);
        (await first.TryConsumeAsync("code-one", "state-one", default)).Should().BeTrue();

        await using var codeReplayDb = new DataContext(options);
        var codeReplay = new StripeConnectOAuthReplayStore(codeReplayDb, TimeProvider.System);
        (await codeReplay.TryConsumeAsync("code-one", "state-two", default)).Should().BeFalse();

        await using var stateReplayDb = new DataContext(options);
        var stateReplay = new StripeConnectOAuthReplayStore(stateReplayDb, TimeProvider.System);
        (await stateReplay.TryConsumeAsync("code-two", "state-one", default)).Should().BeFalse();
    }

    [Fact]
    public async Task TryConsumeAsync_PersistsOnlyHashes_ForAtLeastOneHour()
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"stripe-oauth-replay-{Guid.NewGuid()}").Options);
        var now = new DateTimeOffset(2026, 11, 27, 12, 0, 0, TimeSpan.Zero);
        var store = new StripeConnectOAuthReplayStore(db, new FixedTimeProvider(now));

        (await store.TryConsumeAsync("a-secret-code", "a-secret-state", default)).Should().BeTrue();
        var row = await db.StripeConnectOAuthReplays.SingleAsync();

        row.CodeHash.Should().NotBe("a-secret-code");
        row.StateNonceHash.Should().NotBe("a-secret-state");
        row.ExpiresAt.Should().BeOnOrAfter(now.UtcDateTime.AddHours(1));
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
