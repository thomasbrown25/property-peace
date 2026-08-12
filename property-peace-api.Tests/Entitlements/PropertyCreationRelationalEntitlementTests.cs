using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class PropertyCreationRelationalEntitlementTests
{
    [Fact]
    public async Task Actual_repositories_and_coordinator_roll_back_property_when_actual_unit_insert_fails()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.Context();
        await SeedEntitlementScopeAsync(db);
        await db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER fail_unit_insert BEFORE INSERT ON Units BEGIN SELECT RAISE(ABORT, 'unit insert failed'); END;");
        var properties = PropertyRepository(db);
        var units = UnitRepository(db);
        var coordinator = new EfOrganizationEntitlementMutationCoordinator(db);
        var decisions = DecisionService(db);

        await Assert.ThrowsAsync<Exception>(() => coordinator.ExecuteAsync<bool>(OrganizationId, async token =>
        {
            var decision = await decisions.DecideAsync(Request(), token);
            Assert.True(decision.IsAllowed);
            var property = await properties.AddProperty(NewProperty("Rollback"), token);
            await units.AddUnit(NewUnit(), property.Id, OrganizationId, token);
            return EntitlementMutationOutcome<bool>.Commit(true);
        }));

        await using var verification = database.Context();
        Assert.Empty(await verification.Properties.AsNoTracking().ToListAsync());
        Assert.Empty(await verification.Units.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task Concurrent_last_slot_requests_on_separate_contexts_cannot_both_commit()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using (var seed = database.Context())
        {
            await SeedEntitlementScopeAsync(seed);
            var existing = new Property
            {
                Id = 100,
                OrganizationId = OrganizationId,
                LandlordId = UserId,
                Name = "Existing"
            };
            seed.Properties.Add(existing);
            for (var number = 1; number <= 4; number++)
            {
                seed.Units.Add(new Unit
                {
                    Id = 100 + number,
                    PropertyId = existing.Id,
                    OrganizationId = OrganizationId,
                    Name = $"Unit {number}"
                });
            }
            await seed.SaveChangesAsync();
        }

        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var first = CreateAgainstLastSlotAsync(database, "One", start.Task);
        var second = CreateAgainstLastSlotAsync(database, "Two", start.Task);
        start.SetResult();
        var results = await Task.WhenAll(first, second);

        Assert.Single(results, committed => committed);
        await using var verification = database.Context();
        Assert.Equal(5, await verification.Units.CountAsync(unit =>
            unit.Property.OrganizationId == OrganizationId && !unit.Property.IsDeleted));
        Assert.Equal(2, await verification.Properties.CountAsync(property => !property.IsDeleted));
    }

    private static async Task<bool> CreateAgainstLastSlotAsync(
        TestDatabase database, string name, Task start)
    {
        await start;
        await using var db = database.Context();
        var properties = PropertyRepository(db);
        var units = UnitRepository(db);
        var coordinator = new EfOrganizationEntitlementMutationCoordinator(db);
        var decisions = DecisionService(db);

        try
        {
            var outcome = await coordinator.ExecuteAsync(OrganizationId, async token =>
            {
                var decision = await decisions.DecideAsync(Request(), token);
                if (!decision.IsAllowed)
                {
                    return EntitlementMutationOutcome<bool>.Rollback(false);
                }

                var property = await properties.AddProperty(NewProperty(name), token);
                await units.AddUnit(NewUnit(), property.Id, OrganizationId, token);
                return EntitlementMutationOutcome<bool>.Commit(true);
            });
            return outcome.MutationSucceeded;
        }
        catch (DbUpdateException)
        {
            return false;
        }
        catch (Exception exception) when (exception.InnerException is Microsoft.Data.Sqlite.SqliteException)
        {
            return false;
        }
    }

    private static EntitlementDecisionRequest Request() => new(
        UserId.ToString(), OrganizationId, FeatureKeys.PropertyManagement,
        RequestedQuantity: 1, ResourceOrganizationId: OrganizationId);

    private static EntitlementDecisionService DecisionService(DataContext db) => new(
        new EfEntitlementDecisionFactsProvider(db, new EfEntitlementFeatureFactsLoader(db)),
        TimeProvider.System);

    private static PropertyRepository PropertyRepository(DataContext db) => new(
        db, NullLogger<PropertyRepository>.Instance, MapperFactory.Create());

    private static UnitRepository UnitRepository(DataContext db) => new(
        db, NullLogger<UnitRepository>.Instance, MapperFactory.Create());

    private static UpdatePropertyDto NewProperty(string name) => new()
    {
        Name = name,
        PropertyType = EPropertyType.SingleFamily,
        OrganizationId = OrganizationId,
        LandlordId = UserId
    };

    private static UpdateUnitDto NewUnit() => new()
    {
        Name = "Unit 1",
        Amenities = [],
        IncludedUtility = []
    };

    private static async Task SeedEntitlementScopeAsync(DataContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO Organizations (Id, Name, IsActive, IsDeleted) VALUES (10, 'Relational', 1, 0);
            INSERT INTO OrganizationMembers
                (Id, OrganizationId, UserId, Role, IsActive, CanManageProperties, CanManageTenants,
                 CanManageLeases, CanManageMaintenance, CanManageBilling, CanManageMembers)
                VALUES (1, 10, 42, 'Owner', 1, 0, 0, 0, 0, 0, 0);
            INSERT INTO SubscriptionPlans (Id, Name) VALUES (1, 'Free');
            INSERT INTO Subscriptions (Id, OrganizationId, SubscriptionPlanId, Status)
                VALUES (1, 10, 1, 'Active');
            """);
    }

    private const long OrganizationId = 10;
    private const long UserId = 42;

    private sealed class TestDatabase : IAsyncDisposable
    {
        private readonly string _path;
        private TestDatabase(string path) => _path = path;

        public static async Task<TestDatabase> CreateAsync()
        {
            var database = new TestDatabase(Path.Combine(Path.GetTempPath(), $"property-entitlement-{Guid.NewGuid():N}.db"));
            await using var context = database.Context();
            await context.Database.ExecuteSqlRawAsync("""
                CREATE TABLE Organizations (
                    Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, IsActive INTEGER NOT NULL, IsDeleted INTEGER NOT NULL);
                CREATE TABLE OrganizationMembers (
                    Id INTEGER PRIMARY KEY, OrganizationId INTEGER NOT NULL, UserId INTEGER NOT NULL,
                    Role TEXT, IsActive INTEGER NOT NULL, CanManageProperties INTEGER NOT NULL,
                    CanManageTenants INTEGER NOT NULL, CanManageLeases INTEGER NOT NULL,
                    CanManageMaintenance INTEGER NOT NULL, CanManageBilling INTEGER NOT NULL,
                    CanManageMembers INTEGER NOT NULL);
                CREATE TABLE SubscriptionPlans (Id INTEGER PRIMARY KEY, Name TEXT NOT NULL);
                CREATE TABLE Subscriptions (
                    Id INTEGER PRIMARY KEY, OrganizationId INTEGER, SubscriptionPlanId INTEGER NOT NULL,
                    Status TEXT NOT NULL, CurrentPeriodEnd TEXT, TrialEnd TEXT,
                    CancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0, PausedAtPeriodEnd INTEGER NOT NULL DEFAULT 0,
                    CancelledAt TEXT, PausedAt TEXT);
                CREATE TABLE Properties (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT, Description TEXT NOT NULL DEFAULT '',
                    PropertyType INTEGER NOT NULL, LandlordId INTEGER NOT NULL, ContactEmail TEXT NOT NULL DEFAULT '',
                    ContactPhone TEXT NOT NULL DEFAULT '', OrganizationId INTEGER, PrimaryManagerId INTEGER,
                    OperatingAccountId INTEGER, ClientId INTEGER, StreetAddress TEXT NOT NULL DEFAULT '',
                    City TEXT NOT NULL DEFAULT '', State TEXT NOT NULL DEFAULT '', ZipCode TEXT NOT NULL DEFAULT '',
                    YearBuilt INTEGER NOT NULL DEFAULT 0, LotSize REAL NOT NULL DEFAULT 0,
                    TargetRent TEXT NOT NULL DEFAULT '0', TargetDeposit TEXT NOT NULL DEFAULT '0',
                    MainImageUrl TEXT NOT NULL DEFAULT '', DateListed TEXT NOT NULL,
                    IsDeleted INTEGER NOT NULL DEFAULT 0, DeletedAt TEXT, IsOccupied INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE Units (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT, Name TEXT NOT NULL DEFAULT '',
                    Bedrooms TEXT NOT NULL DEFAULT '', Baths TEXT NOT NULL DEFAULT '', Type TEXT NOT NULL DEFAULT '',
                    SquareFeet INTEGER NOT NULL DEFAULT 0, IsOccupied INTEGER NOT NULL DEFAULT 0,
                    PropertyId INTEGER NOT NULL, OrganizationId INTEGER);
                """);
            return database;
        }

        public DataContext Context() => new(new DbContextOptionsBuilder<DataContext>()
            .UseSqlite($"Data Source={_path};Default Timeout=30;Foreign Keys=False")
            .Options);

        public ValueTask DisposeAsync()
        {
            try { System.IO.File.Delete(_path); }
            catch (IOException) { }
            return ValueTask.CompletedTask;
        }
    }
}
