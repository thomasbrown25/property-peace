using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayReservationPersistenceTests
{
    private static readonly DateOnly Arrival = new(2026, 11, 1);
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private static ShortStayReservation Hold() => ShortStayReservation.CreateHold(
        unitId: 1, propertyId: 2, organizationId: 3, guestUserId: 4,
        payeeUserId: 5, destinationStripeAccountId: "acct_test", checkInDate: Arrival,
        checkOutDate: Arrival.AddDays(2), guestCount: 2, nightlyPricesCents: [12000, 13000],
        expiresAtUtc: Now.AddMinutes(15), nowUtc: Now);

    [Fact]
    public void Hold_uses_half_open_nights_and_immutable_quote()
    {
        var hold = Hold();
        Assert.Equal(ShortStayReservationStatus.Held, hold.Status);
        Assert.Equal([Arrival, Arrival.AddDays(1)], hold.Nights.Select(n => n.Date));
        Assert.Equal([Arrival, Arrival.AddDays(1)], hold.Claims.Select(n => n.Date));
        Assert.Equal(25000, hold.TotalCents);
        Assert.Equal("usd", hold.Currency);
        Assert.Null(hold.StripePaymentIntentId);
        Assert.NotEqual(hold.PublicCode, hold.OperationId);
        Assert.False(string.IsNullOrWhiteSpace(hold.PublicCode));
    }

    [Fact]
    public void Invalid_period_guest_or_quote_cannot_create_hold()
    {
        Assert.Throws<ArgumentException>(() => ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival, Arrival, 2, [], Now.AddMinutes(15), Now));
        Assert.Throws<ArgumentException>(() => ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival, Arrival.AddDays(2), 2, [12000], Now.AddMinutes(15), Now));
        Assert.Throws<ArgumentException>(() => ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival, Arrival.AddDays(1), 0, [12000], Now.AddMinutes(15), Now));
        Assert.Throws<ArgumentException>(() => ShortStayReservation.CreateHold(1, 2, 3, 0, 5, "acct_test", Arrival, Arrival.AddDays(1), 2, [12000], Now.AddMinutes(15), Now));
    }

    [Fact]
    public void Cannot_confirm_without_trusted_payment_evidence()
    {
        var hold = Hold();
        Assert.False(typeof(ShortStayReservation).GetProperty(nameof(ShortStayReservation.Status))!.SetMethod!.IsPublic);
        Assert.DoesNotContain(typeof(ShortStayReservation).GetMethods(), m => m.Name.StartsWith("Confirm", StringComparison.Ordinal));
        Assert.Equal(ShortStayReservationStatus.Held, hold.Status);
        Assert.Null(hold.StripePaymentIntentId);
    }

    [Fact]
    public async Task Unique_claim_per_unit_date_and_unique_identifiers_are_enforced()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        Assert.Equal(2, await f.Db.ShortStayOccupancyClaims.CountAsync());
        f.Db.ChangeTracker.Clear();
        Assert.Equal(2, await f.Db.ShortStayReservationNights.CountAsync());
        Assert.Equal(hold.TotalCents, (await f.Db.ShortStayReservations.SingleAsync()).TotalCents);
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync($"INSERT INTO ShortStayOccupancyClaims (UnitId, Date, ReservationId) VALUES (1, '2026-11-01', {hold.Id})"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync($"INSERT INTO ShortStayOccupancyClaims (UnitId, Date, ReservationId) VALUES (1, '2026-11-03', {hold.Id})"));
        var other = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival.AddDays(2), Arrival.AddDays(4), 2, [12000, 13000], Now.AddMinutes(15), Now);
        other.StripePaymentIntentId = "pi_unique";
        f.Db.ShortStayReservations.Add(other);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var duplicate = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival.AddDays(4), Arrival.AddDays(6), 2, [12000, 13000], Now.AddMinutes(15), Now);
        duplicate.StripePaymentIntentId = "pi_unique";
        f.Db.ShortStayReservations.Add(duplicate);
        await Assert.ThrowsAsync<DbUpdateException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Database_rejects_invalid_dates_amount_and_untrusted_confirmed_state()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        foreach (var sql in new[] {
            $"UPDATE ShortStayReservations SET CheckOutDate = CheckInDate WHERE Id = {hold.Id}",
            $"UPDATE ShortStayReservations SET TotalCents = 0 WHERE Id = {hold.Id}",
            $"UPDATE ShortStayReservations SET Status = 'Confirmed' WHERE Id = {hold.Id}",
            $"UPDATE ShortStayReservationNights SET PriceCents = 0 WHERE ReservationId = {hold.Id}"
        })
            await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync(sql));
        var entity = f.Db.Model.FindEntityType(typeof(ShortStayReservation))!;
        Assert.Contains(entity.GetIndexes(), i => i.IsUnique && i.Properties.Single().Name == "PublicCode");
        Assert.Contains(entity.GetIndexes(), i => i.IsUnique && i.Properties.Single().Name == "OperationId");
        Assert.Contains(entity.GetIndexes(), i => i.IsUnique && i.Properties.Single().Name == "StripePaymentIntentId");
        Assert.True(entity.FindProperty("RowVersion")!.IsConcurrencyToken);
    }

    [Fact]
    public async Task Quote_and_scoped_payee_cannot_be_rewritten_after_hold_creation()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayReservations.Add(Hold());
        await f.Db.SaveChangesAsync();
        var reservation = await f.Db.ShortStayReservations.SingleAsync();
        f.Db.Entry(reservation).Property(x => x.DestinationStripeAccountId).CurrentValue = "acct_swapped";
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
        f.Db.ChangeTracker.Clear();
        var night = await f.Db.ShortStayReservationNights.FirstAsync();
        night.PriceCents = 1;
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Active_hold_requires_complete_claims_at_insert_and_on_deletion()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        hold.Claims.Remove(hold.Claims.First());
        f.Db.ShortStayReservations.Add(hold);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
        f.Db.ChangeTracker.Clear();
        hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        var claim = await f.Db.ShortStayOccupancyClaims.FirstAsync();
        f.Db.ShortStayOccupancyClaims.Remove(claim);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Night_uses_only_composite_reservation_fk_and_sql_rejects_cross_unit_night()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        var type = f.Db.Model.FindEntityType(typeof(ShortStayReservationNight))!;
        Assert.Single(type.GetForeignKeys().Where(k => k.PrincipalEntityType.ClrType == typeof(ShortStayReservation)));
        Assert.Contains(type.GetForeignKeys(), k => k.PrincipalEntityType.ClrType == typeof(ShortStayReservation) &&
            k.Properties.Select(p => p.Name).SequenceEqual(["ReservationId", "UnitId"]));
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id) VALUES (99)");
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync(
            $"INSERT INTO ShortStayReservationNights (ReservationId, UnitId, Date, PriceCents) VALUES ({hold.Id}, 99, '2026-11-04', 100)"));
    }

    [Fact]
    public async Task Database_rejects_unknown_status_and_amount_over_payment_intent_limit()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync($"UPDATE ShortStayReservations SET Status = 'Other' WHERE Id = {hold.Id}"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync($"UPDATE ShortStayReservations SET TotalCents = 100000000 WHERE Id = {hold.Id}"));
    }

    [Fact]
    public void Factory_rejects_quote_above_payment_intent_maximum()
    {
        Assert.Throws<ArgumentException>(() => ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival,
            Arrival.AddDays(2), 1, [99999999, 1], Now.AddMinutes(15), Now));
    }

    [Fact]
    public async Task Quote_components_are_persisted_and_sql_rejects_mismatch()
    {
        await using var f = await Fixture.Create();
        var hold = ShortStayReservation.CreateHold(1, 2, 3, 4, 5, "acct_test", Arrival, Arrival.AddDays(2),
            2, [12000, 13000], Now.AddMinutes(15), Now, cleaningFeeCents: 5000, taxCents: 2000);
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        Assert.Equal(32000, hold.TotalCents);
        Assert.Equal(25000, hold.NightlySubtotalCents);
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync(
            $"UPDATE ShortStayReservations SET TotalCents = 31000 WHERE Id = {hold.Id}"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync(
            $"UPDATE ShortStayReservations SET CleaningFeeCents = -1 WHERE Id = {hold.Id}"));
    }

    [Theory]
    [InlineData(ShortStayReservationStatus.Held, false)]
    [InlineData(ShortStayReservationStatus.PendingPayment, false)]
    [InlineData(ShortStayReservationStatus.Processing, false)]
    [InlineData(ShortStayReservationStatus.Confirmed, false)]
    [InlineData(ShortStayReservationStatus.RefundRequired, false)]
    [InlineData(ShortStayReservationStatus.Disputed, false)]
    [InlineData(ShortStayReservationStatus.Expired, true)]
    [InlineData(ShortStayReservationStatus.Failed, true)]
    [InlineData(ShortStayReservationStatus.Refunded, true)]
    public async Task Claim_release_is_restricted_to_terminal_non_occupying_states(ShortStayReservationStatus status, bool allowed)
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        // Set persisted status directly: this isolates the release policy from the transition policy.
        var sql = status == ShortStayReservationStatus.Confirmed
            ? $"UPDATE ShortStayReservations SET Status = 'Confirmed', StripePaymentIntentId = 'pi_test', PaymentConfirmedAtUtc = '2026-10-20 12:01:00+00:00' WHERE Id = {hold.Id}"
            : $"UPDATE ShortStayReservations SET Status = '{status}' WHERE Id = {hold.Id}";
        await f.Db.Database.ExecuteSqlRawAsync(sql);
        var claim = await f.Db.ShortStayOccupancyClaims.FirstAsync();
        f.Db.ShortStayOccupancyClaims.Remove(claim);
        if (allowed) await f.Db.SaveChangesAsync();
        else await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Status_transition_requires_valid_edge_and_version_increment()
    {
        await using var f = await Fixture.Create();
        var hold = Hold();
        f.Db.ShortStayReservations.Add(hold);
        await f.Db.SaveChangesAsync();
        f.Db.Entry(hold).Property(r => r.Status).CurrentValue = ShortStayReservationStatus.Expired;
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
        f.Db.Entry(hold).Property(r => r.RowVersion).CurrentValue = 2;
        await f.Db.SaveChangesAsync();
        Assert.Equal(2, (await f.Db.ShortStayReservations.AsNoTracking().SingleAsync()).RowVersion);
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
            foreach (var (table, id) in new[] { ("Units", 1), ("Properties", 2), ("Organizations", 3), ("Users", 4), ("Users", 5) }.DistinctBy(x => x.Item1))
                await f.Db.Database.ExecuteSqlRawAsync($"CREATE TABLE {table} (Id INTEGER PRIMARY KEY)");
            foreach (var (table, id) in new[] { ("Units", 1), ("Properties", 2), ("Organizations", 3), ("Users", 4), ("Users", 5) })
                await f.Db.Database.ExecuteSqlRawAsync($"INSERT INTO {table} (Id) VALUES ({id})");
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "ShortStayReservations", "ShortStayReservationNights", "ShortStayOccupancyClaims" })
            {
                var create = Regex.Match(ddl, $"CREATE TABLE [^;]*\\\"{table}\\\"[^;]*;", RegexOptions.Singleline);
                Assert.True(create.Success, $"Missing EF DDL for {table}");
                await f.Db.Database.ExecuteSqlRawAsync(create.Value);
                foreach (Match index in Regex.Matches(ddl, $"CREATE (?:UNIQUE )?INDEX [^;]* ON \\\"{table}\\\"[^;]*;", RegexOptions.Singleline))
                    await f.Db.Database.ExecuteSqlRawAsync(index.Value);
            }
            return f;
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await _connection.DisposeAsync(); }
    }
}
