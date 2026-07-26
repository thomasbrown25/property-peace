using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.AdminDashboard;
using brownstone_hub_api.Tests.Helpers;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.AdminDashboard;

public sealed class AdminDashboardRepositoryTests
{
    private static readonly DateTime GeneratedAtUtc = new(2026, 7, 25, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task GetSummaryAsync_UsesCurrentLeaseDateBoundariesAndDerivesOccupancyFromLeases()
    {
        await using var context = DbContextFactory.Create();
        var landlord = CreateUser(1, "landlord@example.com", GeneratedAtUtc.AddDays(-100), null);
        var property = new Property { Id = 1, LandlordId = landlord.Id, Landlord = landlord };
        context.Users.Add(landlord);
        context.Properties.Add(property);

        AddLease(context, property, 1, GeneratedAtUtc.Date, GeneratedAtUtc.Date, isOccupiedFlag: false);
        AddLease(context, property, 2, GeneratedAtUtc.Date.AddDays(-10), GeneratedAtUtc.Date.AddDays(30), isOccupiedFlag: false);
        AddLease(context, property, 3, GeneratedAtUtc.Date.AddDays(-10), GeneratedAtUtc.Date.AddDays(31), isOccupiedFlag: false);
        AddLease(context, property, 4, GeneratedAtUtc.Date.AddDays(1), GeneratedAtUtc.Date.AddDays(30), isOccupiedFlag: true);
        AddLease(context, property, 5, GeneratedAtUtc.Date.AddDays(-10), GeneratedAtUtc.Date.AddDays(-1), isOccupiedFlag: true);
        AddLease(context, property, 6, GeneratedAtUtc.Date.AddDays(-10), GeneratedAtUtc.Date.AddDays(10), isOccupiedFlag: true, isActive: false);
        AddLease(context, property, 7, GeneratedAtUtc.Date.AddDays(-10), GeneratedAtUtc.Date.AddDays(10), isOccupiedFlag: true, isDeleted: true);
        AddLease(context, property, 8, null, GeneratedAtUtc.Date.AddDays(10), isOccupiedFlag: true);
        AddLease(context, property, 9, GeneratedAtUtc.Date.AddDays(-10), null, isOccupiedFlag: true);
        await context.SaveChangesAsync();

        var result = await new AdminDashboardRepository(context).GetSummaryAsync(30, GeneratedAtUtc);

        Assert.Equal(9, result.Portfolio.Units);
        Assert.Equal(3, result.Portfolio.ActiveLeases);
        Assert.Equal(3, result.Portfolio.OccupiedUnits);
        Assert.Equal(6, result.Portfolio.VacantUnits);
        Assert.Equal(2, result.Portfolio.LeasesExpiringWithin30Days);
    }

    [Fact]
    public async Task GetSummaryAsync_UsesLaterOfLastLoginAndLastVisitedWithExplicitNullHandling()
    {
        await using var context = DbContextFactory.Create();
        var windowStart = GeneratedAtUtc.AddDays(-7);
        context.Users.AddRange(
            CreateUser(1, "visited@example.com", GeneratedAtUtc.AddDays(-1), GeneratedAtUtc.AddDays(-20)),
            CreateUser(2, "login@example.com", GeneratedAtUtc.AddDays(-20), GeneratedAtUtc.AddDays(-1)),
            CreateUser(3, "boundary@example.com", windowStart, null),
            CreateUser(4, "inactive@example.com", GeneratedAtUtc.AddDays(-20), GeneratedAtUtc.AddDays(-10)));
        await context.SaveChangesAsync();

        var result = await new AdminDashboardRepository(context).GetSummaryAsync(7, GeneratedAtUtc);

        Assert.Equal(3, result.Accounts.RecentlyActiveUsers);
        Assert.Equal(GeneratedAtUtc.AddDays(-1), result.RecentAccounts.Single(user => user.UserId == 1).LastActiveAtUtc);
        Assert.Equal(GeneratedAtUtc.AddDays(-1), result.RecentAccounts.Single(user => user.UserId == 2).LastActiveAtUtc);
        Assert.Equal(windowStart, result.RecentAccounts.Single(user => user.UserId == 3).LastActiveAtUtc);
        Assert.Equal(GeneratedAtUtc.AddDays(-10), result.RecentAccounts.Single(user => user.UserId == 4).LastActiveAtUtc);
    }

    private static User CreateUser(long id, string email, DateTime lastVisited, DateTime? lastLogin) => new()
    {
        Id = id,
        FirstName = "Test",
        LastName = id.ToString(),
        Email = email,
        CreateDate = GeneratedAtUtc.AddDays(-id),
        LastVisited = lastVisited,
        LastLogin = lastLogin
    };

    private static void AddLease(
        brownstone_hub_api.Data.DataContext context,
        Property property,
        long id,
        DateTime? startDate,
        DateTime? endDate,
        bool isOccupiedFlag,
        bool isActive = true,
        bool isDeleted = false)
    {
        var unit = new Unit
        {
            Id = id,
            Name = $"Unit {id}",
            PropertyId = property.Id,
            Property = property,
            IsOccupied = isOccupiedFlag
        };
        var lease = new Lease
        {
            Id = id,
            UnitId = unit.Id,
            Unit = unit,
            StartDate = startDate,
            EndDate = endDate,
            IsActive = isActive,
            IsDeleted = isDeleted
        };
        unit.Lease = lease;
        context.Units.Add(unit);
        context.Leases.Add(lease);
    }
}
