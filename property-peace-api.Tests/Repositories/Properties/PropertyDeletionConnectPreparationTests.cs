using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Properties;

public sealed class PropertyDeletionConnectPreparationTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Delete_removes_only_target_links_and_invalidates_affected_attestations(bool scoped)
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.Context();
        var repository = Repository(db);

        var result = scoped
            ? await repository.DeleteProperty(101, 10, CancellationToken.None)
            : await repository.DeleteProperty(101);

        Assert.Equal(101, result.Id);
        db.ChangeTracker.Clear();
        Assert.Null(await db.Properties.FindAsync(101L));
        Assert.NotNull(await db.Properties.FindAsync(202L));
        var links = await db.StripeConnectPreparationProperties.ToListAsync();
        Assert.Equal(2, links.Count);
        Assert.All(links, link => Assert.Equal(202, link.PropertyId));
        var preparations = await db.StripeConnectPreparations.OrderBy(x => x.Id).ToListAsync();
        Assert.Equal(3, preparations.Count);
        foreach (var preparation in preparations.Take(2))
        {
            Assert.False(preparation.AuthorityAttested);
            Assert.Null(preparation.AuthorityAttestedAt);
            Assert.True(preparation.UpdatedAt > TestDatabase.OriginalTime);
        }
        Assert.True(preparations[2].AuthorityAttested);
        Assert.Equal(TestDatabase.OriginalTime, preparations[2].UpdatedAt);
    }

    [Fact]
    public async Task Foreign_organization_cannot_delete_property_or_modify_preparation()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.Context();
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            Repository(db).DeleteProperty(101, 99, CancellationToken.None));
        Assert.Equal(2, await db.Properties.CountAsync());
        Assert.Equal(4, await db.StripeConnectPreparationProperties.CountAsync());
        Assert.All(await db.StripeConnectPreparations.ToListAsync(), p => Assert.True(p.AuthorityAttested));
    }

    [Fact]
    public async Task Failed_property_delete_rolls_back_link_cleanup_and_attestation_changes()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.Context();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TRIGGER reject_property_delete BEFORE DELETE ON Properties
            BEGIN SELECT RAISE(ABORT, 'simulated remaining dependency'); END;
            """);
        await Assert.ThrowsAsync<DbUpdateException>(() =>
            Repository(db).DeleteProperty(101, 10, CancellationToken.None));
        db.ChangeTracker.Clear();
        Assert.Equal(2, await db.Properties.CountAsync());
        Assert.Equal(4, await db.StripeConnectPreparationProperties.CountAsync());
        Assert.All(await db.StripeConnectPreparations.ToListAsync(), p =>
        {
            Assert.True(p.AuthorityAttested);
            Assert.Equal(TestDatabase.OriginalTime, p.UpdatedAt);
        });
    }

    [Fact]
    public async Task Database_rejects_property_delete_without_link_cleanup()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.Context();
        var exception = await Assert.ThrowsAsync<SqliteException>(() =>
            db.Database.ExecuteSqlRawAsync("DELETE FROM Properties WHERE Id = 101"));
        Assert.Equal(19, exception.SqliteErrorCode);
    }

    private static PropertyRepository Repository(DataContext db) =>
        new(db, NullLogger<PropertyRepository>.Instance, MapperFactory.Create());

    private sealed class TestDatabase(SqliteConnection connection) : IAsyncDisposable
    {
        public static readonly DateTimeOffset OriginalTime = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        public DataContext Context() => new(new DbContextOptionsBuilder<DataContext>()
            .UseSqlite(connection).Options);

        public static async Task<TestDatabase> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=True");
            await connection.OpenAsync();
            var database = new TestDatabase(connection);
            await using var db = database.Context();
            // Minimal relational schema: use every scalar column from the production model,
            // but only the FKs relevant to this regression. No external database is touched.
            foreach (var type in new[] { typeof(Property), typeof(StripeConnectPreparation), typeof(StripeConnectPreparationProperty) })
            {
                var entity = db.Model.FindEntityType(type)!;
                var columns = entity.GetProperties().Select(property =>
                {
                    var clr = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                    var storage = clr == typeof(byte[]) ? "BLOB"
                        : clr == typeof(long) || clr == typeof(int) || clr == typeof(bool) || clr.IsEnum ? "INTEGER" : "TEXT";
                    return $"\"{property.GetColumnName()}\" {storage}"
                        + (property.Name == "Id" ? " PRIMARY KEY" : clr == typeof(bool) ? " DEFAULT 0" : "");
                }).ToList();
                if (type == typeof(StripeConnectPreparationProperty))
                {
                    columns.Add("FOREIGN KEY (PropertyId) REFERENCES Properties(Id) ON DELETE RESTRICT");
                    columns.Add("FOREIGN KEY (StripeConnectPreparationId) REFERENCES StripeConnectPreparations(Id) ON DELETE CASCADE");
                }
                await db.Database.ExecuteSqlRawAsync($"CREATE TABLE \"{entity.GetTableName()}\" ({string.Join(", ", columns)})");
            }
            db.Properties.AddRange(
                new Property { Id = 101, OrganizationId = 10, LandlordId = 1, Name = "Target" },
                new Property { Id = 202, OrganizationId = 10, LandlordId = 1, Name = "Retained" });
            for (var id = 1; id <= 3; id++)
            {
                var preparation = new StripeConnectPreparation
                {
                    Id = id, UserId = id, OrganizationId = 10,
                    AuthorityAttested = true, AuthorityAttestedAt = OriginalTime,
                    CreatedAt = OriginalTime, UpdatedAt = OriginalTime
                };
                if (id <= 2)
                    preparation.Properties.Add(new StripeConnectPreparationProperty { PropertyId = 101 });
                if (id != 2)
                    preparation.Properties.Add(new StripeConnectPreparationProperty { PropertyId = 202 });
                db.StripeConnectPreparations.Add(preparation);
            }
            await db.SaveChangesAsync();
            return database;
        }

        public ValueTask DisposeAsync() => connection.DisposeAsync();
    }
}
