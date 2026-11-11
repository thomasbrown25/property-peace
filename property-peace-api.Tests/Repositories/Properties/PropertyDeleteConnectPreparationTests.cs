using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Properties;

public sealed class PropertyDeleteConnectPreparationTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Delete_removes_only_target_selections_and_requires_affected_drafts_to_be_attested_again(bool legacy)
    {
        await using var fixture = await Fixture.Create();
        var db = fixture.Db;
        var repository = Repository(db);
        if (legacy) await repository.DeleteProperty(137);
        else await repository.DeleteProperty(137, 10, CancellationToken.None);
        db.ChangeTracker.Clear();

        Assert.False(await db.Properties.AnyAsync(x => x.Id == 137));
        Assert.True(await db.Properties.AnyAsync(x => x.Id == 138));
        var deleted = await db.ActivityEvents.SingleAsync(x => x.ActivityType == "Property" && x.Operation == "Deleted");
        Assert.Equal(137, deleted.RelatedId);
        Assert.Equal(137, deleted.PropertyId);
        Assert.Equal(10, deleted.OrganizationId);
        Assert.Equal(2, await db.StripeConnectPreparationProperties.CountAsync());
        Assert.False(await db.StripeConnectPreparationProperties.AnyAsync(x => x.PropertyId == 137));
        var drafts = await db.StripeConnectPreparations.OrderBy(x => x.Id).ToListAsync();
        Assert.Equal(3, drafts.Count);
        foreach (var draft in drafts.Take(2))
        {
            Assert.False(draft.AuthorityAttested);
            Assert.Null(draft.AuthorityAttestedAt);
            Assert.Equal("Setup draft", draft.DisplayName);
        }
        Assert.True(drafts[2].AuthorityAttested);
        Assert.NotNull(drafts[2].AuthorityAttestedAt);
    }

    [Fact]
    public async Task Foreign_organization_cannot_delete_property_or_change_any_draft()
    {
        await using var fixture = await Fixture.Create();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Repository(fixture.Db)
            .DeleteProperty(137, 20, CancellationToken.None));
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(2, await fixture.Db.Properties.CountAsync());
        Assert.Equal(4, await fixture.Db.StripeConnectPreparationProperties.CountAsync());
        Assert.True(await fixture.Db.StripeConnectPreparations.AllAsync(x => x.AuthorityAttested));
    }

    [Fact]
    public async Task Other_restrictive_references_roll_back_property_and_draft_changes_together()
    {
        await using var fixture = await Fixture.Create();
        await fixture.Db.Database.ExecuteSqlRawAsync("CREATE TABLE RetainedHistory (PropertyId INTEGER NOT NULL REFERENCES Properties(Id) ON DELETE RESTRICT); INSERT INTO RetainedHistory VALUES (137);");
        await Assert.ThrowsAsync<DbUpdateException>(() => Repository(fixture.Db)
            .DeleteProperty(137, 10, CancellationToken.None));
        fixture.Db.ChangeTracker.Clear();
        Assert.True(await fixture.Db.Properties.AnyAsync(x => x.Id == 137));
        Assert.Equal(4, await fixture.Db.StripeConnectPreparationProperties.CountAsync());
        Assert.True(await fixture.Db.StripeConnectPreparations.AllAsync(x => x.AuthorityAttested));
    }

    private static PropertyRepository Repository(DataContext db) =>
        new(db, NullLogger<PropertyRepository>.Instance, MapperFactory.Create());

    private sealed class Fixture(SqliteConnection connection, DataContext db) : IAsyncDisposable
    {
        public DataContext Db { get; } = db;

        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=True");
            await connection.OpenAsync();
            var db = new DataContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            var ddl = db.Database.GenerateCreateScript();
            foreach (var table in new[] { "Properties", "StripeConnectPreparations", "StripeConnectPreparationProperties", "ActivityEvents" })
            {
                var match = Regex.Match(ddl, $"CREATE TABLE \"{table}\"[^;]*;", RegexOptions.Singleline);
                Assert.True(match.Success, $"Missing EF DDL for {table}");
                // Isolate the production tables used here; keep both actual selection FKs intact.
                var create = table == "StripeConnectPreparationProperties" ? match.Value
                    : Regex.Replace(string.Join('\n', match.Value.Split('\n').Where(line => !line.Contains("FOREIGN KEY"))), @",\s*\);", "\n);");
                try { await db.Database.ExecuteSqlRawAsync(create); }
                catch (SqliteException ex) { throw new InvalidOperationException(create, ex); }
            }
            db.Properties.AddRange(
                new Property { Id = 137, OrganizationId = 10, LandlordId = 99, Name = "Target", StreetAddress = "137 Test Street" },
                new Property { Id = 138, OrganizationId = 10, LandlordId = 99, Name = "Keep", StreetAddress = "138 Test Street" });
            var now = DateTimeOffset.UtcNow;
            for (var i = 1; i <= 3; i++)
            {
                var draft = new StripeConnectPreparation
                {
                    Id = i, UserId = i, OrganizationId = 10, OperatingType = "individual",
                    DisplayName = "Setup draft", AuthorityRelationship = "owner",
                    AuthorityAttested = true, AuthorityAttestedAt = now, CreatedAt = now, UpdatedAt = now
                };
                if (i <= 2) draft.Properties.Add(new StripeConnectPreparationProperty { PropertyId = 137 });
                if (i != 2) draft.Properties.Add(new StripeConnectPreparationProperty { PropertyId = 138 });
                db.StripeConnectPreparations.Add(draft);
            }
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            return new Fixture(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
