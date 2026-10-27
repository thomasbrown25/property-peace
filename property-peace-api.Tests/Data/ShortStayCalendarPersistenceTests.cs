using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.ShortStay;

public sealed class ShortStayCalendarPersistenceTests
{
    [Fact]
    public async Task Blocks_round_trip_half_open_dates_optional_reason_and_creation_time()
    {
        await using var fixture = await Fixture.Create();
        var created = new DateTime(2026, 10, 20, 12, 30, 0, DateTimeKind.Utc);
        fixture.Db.ShortStayBlocks.AddRange(
            new ShortStayBlock { UnitId = 1, StartDate = new DateOnly(2026, 11, 1), EndDate = new DateOnly(2026, 11, 3), Reason = "Owner use", CreatedAtUtc = created },
            new ShortStayBlock { UnitId = 1, StartDate = new DateOnly(2026, 11, 3), EndDate = new DateOnly(2026, 11, 4), CreatedAtUtc = created });
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();
        var blocks = await fixture.Db.ShortStayBlocks.OrderBy(x => x.StartDate).ToListAsync();
        Assert.Equal(2, blocks.Count);
        Assert.Equal(new DateOnly(2026, 11, 3), blocks[0].EndDate);
        Assert.Equal(blocks[0].EndDate, blocks[1].StartDate); // adjacent is legal
        Assert.Equal("Owner use", blocks[0].Reason);
        Assert.Null(blocks[1].Reason);
        Assert.Equal(created, blocks[0].CreatedAtUtc);
        Assert.Equal("ShortStayBlocks", fixture.Db.Model.FindEntityType(typeof(ShortStayBlock))!.GetTableName());
    }

    [Fact]
    public async Task Block_range_fk_and_reason_bounds_are_relationally_enforced()
    {
        await using var f = await Fixture.Create();
        await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayBlocks (UnitId, StartDate, EndDate, CreatedAtUtc) VALUES (1, '2026-11-01', '2026-11-02', '2026-10-20')");
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayBlocks (UnitId, StartDate, EndDate, CreatedAtUtc) VALUES (1, '2026-11-02', '2026-11-02', '2026-10-20')"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayBlocks (UnitId, StartDate, EndDate, CreatedAtUtc) VALUES (999, '2026-11-02', '2026-11-03', '2026-10-20')"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("DELETE FROM Units WHERE Id = 1"));
        var entity = f.Db.Model.FindEntityType(typeof(ShortStayBlock))!;
        Assert.Equal(500, entity.FindProperty(nameof(ShortStayBlock.Reason))!.GetMaxLength());
        Assert.Equal(DeleteBehavior.NoAction, Assert.Single(entity.GetForeignKeys()).DeleteBehavior);
        Assert.Contains(entity.GetIndexes(), i => i.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId", "StartDate", "EndDate" }));
    }

    [Fact]
    public async Task Per_date_rates_round_trip_and_unique_unit_date_is_enforced()
    {
        await using var f = await Fixture.Create();
        f.Db.ShortStayNightlyRateOverrides.AddRange(
            new ShortStayNightlyRateOverride { UnitId = 1, Date = new DateOnly(2026, 11, 1), NightlyRate = 129.50m },
            new ShortStayNightlyRateOverride { UnitId = 1, Date = new DateOnly(2026, 11, 2), NightlyRate = 145.25m });
        await f.Db.SaveChangesAsync();
        f.Db.ChangeTracker.Clear();
        Assert.Equal(129.50m, (await f.Db.ShortStayNightlyRateOverrides.SingleAsync(x => x.Date == new DateOnly(2026, 11, 1))).NightlyRate);
        var entity = f.Db.Model.FindEntityType(typeof(ShortStayNightlyRateOverride))!;
        Assert.Equal("ShortStayNightlyRateOverrides", entity.GetTableName());
        Assert.Equal(18, entity.FindProperty(nameof(ShortStayNightlyRateOverride.NightlyRate))!.GetPrecision());
        Assert.Equal(2, entity.FindProperty(nameof(ShortStayNightlyRateOverride.NightlyRate))!.GetScale());
        Assert.Equal(DeleteBehavior.NoAction, Assert.Single(entity.GetForeignKeys()).DeleteBehavior);
        Assert.Contains(entity.GetIndexes(), i => i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "UnitId", "Date" }));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayNightlyRateOverrides (UnitId, Date, NightlyRate) VALUES (1, '2026-11-01', 200)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayNightlyRateOverrides (UnitId, Date, NightlyRate) VALUES (1, '2026-11-03', 0)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("INSERT INTO ShortStayNightlyRateOverrides (UnitId, Date, NightlyRate) VALUES (999, '2026-11-03', 50)"));
        await Assert.ThrowsAsync<SqliteException>(() => f.Db.Database.ExecuteSqlRawAsync("DELETE FROM Units WHERE Id = 1"));
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
            await f.Db.Database.ExecuteSqlRawAsync("INSERT INTO Units (Id) VALUES (1)");
            var ddl = f.Db.Database.GenerateCreateScript();
            foreach (var table in new[] { "ShortStayBlocks", "ShortStayNightlyRateOverrides" })
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
