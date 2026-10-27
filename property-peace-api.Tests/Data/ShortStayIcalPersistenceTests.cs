using System.Text.Json;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayIcalPersistenceTests
{
    [Fact]
    public async Task Subscription_and_occurrences_round_trip_without_plaintext_or_guest_data()
    {
        await using var f = await Fixture.Create();
        var crypto = new ShortStayIcalSecretProtector(Convert.ToBase64String(new byte[32] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 }));
        const string url = "https://example.test/feed?secret=do-not-store";
        var leaseToken = Guid.NewGuid();
        var leaseExpiry = new DateTime(2026, 10, 20, 12, 5, 0, DateTimeKind.Utc);
        var sub = new ShortStayIcalSubscription
        {
            UnitId = 1, OrgId = 2, EncryptedUrl = crypto.EncryptUrl(url), UrlFingerprint = crypto.FingerprintUrl(url),
            Generation = 3, Enabled = true, ConsecutiveFailures = 1, FailureCode = "FetchFailed",
            LastAttemptAtUtc = new DateTime(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc),
            NextAttemptAtUtc = new DateTime(2026, 10, 20, 13, 0, 0, DateTimeKind.Utc),
            LeaseToken = leaseToken, LeaseExpiresAtUtc = leaseExpiry
        };
        sub.Occurrences.Add(new ShortStayIcalOccurrence
        {
            UidKey = crypto.FingerprintEventIdentity("secret-guest-uid", ""),
            RecurrenceKey = crypto.FingerprintEventIdentity("secret-guest-uid", "20261101"),
            StartDate = new DateOnly(2026, 11, 1), EndDate = new DateOnly(2026, 11, 3)
        });
        f.Db.ShortStayIcalSubscriptions.Add(sub);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var loaded = await f.Db.ShortStayIcalSubscriptions.Include(x => x.Occurrences).SingleAsync();
        Assert.Equal(url, crypto.DecryptUrl(loaded.EncryptedUrl));
        Assert.NotEqual(url, loaded.EncryptedUrl);
        Assert.Equal(3, loaded.Generation);
        Assert.Equal(leaseToken, loaded.LeaseToken);
        Assert.Equal(leaseExpiry, loaded.LeaseExpiresAtUtc);
        Assert.Single(loaded.Occurrences);
        Assert.Equal(new DateOnly(2026, 11, 3), loaded.Occurrences.Single().EndDate);
        var json = JsonSerializer.Serialize(loaded);
        Assert.DoesNotContain(url, json);
        Assert.DoesNotContain("EncryptedUrl", json);
        Assert.DoesNotContain("UrlFingerprint", json);
        Assert.DoesNotContain("LeaseToken", json);
        Assert.DoesNotContain("UidKey", json);
        Assert.DoesNotContain("RecurrenceKey", json);
        Assert.DoesNotContain("secret-guest", json);
    }

    [Fact]
    public async Task Relational_constraints_fks_and_indexes_are_enforced()
    {
        await using var f = await Fixture.Create();
        var sub = f.Db.Model.FindEntityType(typeof(ShortStayIcalSubscription))!;
        var occurrence = f.Db.Model.FindEntityType(typeof(ShortStayIcalOccurrence))!;
        Assert.Equal("ShortStayIcalSubscriptions", sub.GetTableName());
        Assert.Equal("ShortStayIcalOccurrences", occurrence.GetTableName());
        Assert.Contains(sub.GetIndexes(), x => x.IsUnique && x.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId" }));
        Assert.Contains(sub.GetIndexes(), x => x.IsUnique && x.Properties.Select(p => p.Name).SequenceEqual(new[] { "LeaseToken" }));
        Assert.Contains(sub.GetIndexes(), x => x.Properties.Select(p => p.Name).SequenceEqual(new[] { "Enabled", "NextAttemptAtUtc", "LeaseExpiresAtUtc" }));
        Assert.Contains(occurrence.GetIndexes(), x => x.IsUnique && x.Properties.Select(p => p.Name).SequenceEqual(new[] { "SubscriptionId", "UidKey", "RecurrenceKey" }));
        Assert.Contains(occurrence.GetIndexes(), x => x.Properties.Select(p => p.Name).SequenceEqual(new[] { "SubscriptionId", "StartDate", "EndDate" }));
        Assert.All(sub.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
        Assert.Equal(DeleteBehavior.Cascade, Assert.Single(occurrence.GetForeignKeys()).DeleteBehavior);
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (1, 2, 'encrypted', 'fingerprint', 1, 1, 0)");
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (1, 2, 'other', 'fingerprint', 1, 1, 0)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (99, 2, 'x', 'fp2', 1, 1, 0)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (1, 99, 'x', 'fp2', 1, 1, 0)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (1, 2, 'x', 'fp2', 0, 1, 0)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (1, 2, 'x', 'fp2', 1, 1, -1)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseToken = 'claim' WHERE Id = 1"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseExpiresAtUtc = '2026-10-20 12:05:00' WHERE Id = 1"));
        await f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseToken = 'claim', LeaseExpiresAtUtc = '2026-10-20 12:05:00' WHERE Id = 1");
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id) VALUES (3)");
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalSubscriptions (UnitId, OrgId, EncryptedUrl, UrlFingerprint, Generation, Enabled, ConsecutiveFailures) VALUES (3, 2, 'other', 'fp3', 1, 1, 0)");
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseToken = 'claim', LeaseExpiresAtUtc = '2026-10-20 12:05:00' WHERE UnitId = 3"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseToken = NULL WHERE Id = 1"));
        await f.Db.Database.ExecuteSqlRawAsync("UPDATE ShortStayIcalSubscriptions SET LeaseToken = NULL, LeaseExpiresAtUtc = NULL WHERE Id = 1");
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalOccurrences (SubscriptionId, UidKey, RecurrenceKey, StartDate, EndDate) VALUES (1, 'uid', 'recurrence', '2026-11-01', '2026-11-03')");
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalOccurrences (SubscriptionId, UidKey, RecurrenceKey, StartDate, EndDate) VALUES (1, 'uid', 'recurrence', '2026-12-01', '2026-12-03')"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalOccurrences (SubscriptionId, UidKey, RecurrenceKey, StartDate, EndDate) VALUES (1, 'uid2', 'r', '2026-11-03', '2026-11-03')"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayIcalOccurrences (SubscriptionId, UidKey, RecurrenceKey, StartDate, EndDate) VALUES (99, 'uid2', 'r', '2026-11-03', '2026-11-04')"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("DELETE FROM Units WHERE Id = 1"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("DELETE FROM Organizations WHERE Id = 2"));
        await f.Db.Database.ExecuteSqlRawAsync("DELETE FROM ShortStayIcalSubscriptions WHERE Id = 1");
        Assert.Empty(await f.Db.ShortStayIcalOccurrences.ToListAsync());
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection)
        {
            _connection = connection;
            Db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
        }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var f = new Fixture(connection);
            await f.Db.Database.ExecuteSqlRawAsync("CREATE TABLE Units (Id INTEGER PRIMARY KEY)");
            await f.Db.Database.ExecuteSqlRawAsync("CREATE TABLE Organizations (Id INTEGER PRIMARY KEY)");
            await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id) VALUES (1)");
            await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO Organizations (Id) VALUES (2)");
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "ShortStayIcalSubscriptions", "ShortStayIcalOccurrences" })
            {
                var create = Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
                Assert.True(create.Success, $"Missing EF DDL for {table}");
                await f.Db.Database.ExecuteSqlRawAsync(create.Value);
                foreach (Match index in Regex.Matches(ddl, $"CREATE (?:UNIQUE )?INDEX [^;]* ON \\\"{table}\\\"[^;]*;", RegexOptions.Singleline))
                    await f.Db.Database.ExecuteSqlRawAsync(index.Value);
            }
            return f;
        }
        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }
}
