using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Activity;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using FeedService = brownstone_hub_api.Services.ActivityService.ActivityService;

namespace brownstone_hub_api.Tests.Services;

public sealed class ActivityServiceTests
{
    private static readonly string[] Types = ["LeaseAgreement", "Lease", "Property", "BankAccount", "TeamMember", "Listing", "Calendar", "Booking", "Tenant", "Checklist", "Announcement", "Payment"];

    private sealed class Fixture : IAsyncDisposable
    {
        public DataContext Db { get; } = new(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public DefaultHttpContext Http { get; } = new();
        public FeedService Service { get; }
        public Fixture()
        {
            var users = new Mock<IUserService>();
            users.Setup(u => u.GetCurrentUserIdAsync()).ReturnsAsync(new ServiceResponse<long?> { Data = 42, Success = true });
            Service = new FeedService(Db, Mock.Of<IUserRepository>(), users.Object,
                new HttpContextAccessor { HttpContext = Http }, NullLogger<FeedService>.Instance);
            Http.Items["OrganizationId"] = 17L;
        }
        public async Task Seed()
        {
            Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 17, UserId = 42, Role = "Owner", IsActive = true });
            await Db.SaveChangesAsync();
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Theory]
    [InlineData("LeaseAgreement")]
    [InlineData("Lease")]
    [InlineData("Property")]
    [InlineData("BankAccount")]
    [InlineData("TeamMember")]
    [InlineData("Listing")]
    [InlineData("Calendar")]
    [InlineData("Booking")]
    [InlineData("Tenant")]
    [InlineData("Checklist")]
    [InlineData("Announcement")]
    [InlineData("Payment")]
    public async Task All_categories_return_operations_without_requiring_original_entity(string type)
    {
        await using var f = new Fixture();
        await f.Seed();
        var now = DateTime.UtcNow.AddDays(-1);
        foreach (var operation in new[] { "Created", "Updated", "Deleted" })
            f.Db.ActivityEvents.Add(new ActivityEvent { ActivityType = type, Operation = operation,
                OrganizationId = 17, RelatedId = 999, PropertyId = 10, CreatedAt = now = now.AddMinutes(1), Title = $"{type} {operation}" });
        f.Db.ActivityEvents.Add(new ActivityEvent { ActivityType = type, Operation = "Deleted", OrganizationId = 99, CreatedAt = DateTime.UtcNow });
        await f.Db.SaveChangesAsync();
        var result = await f.Service.GetActivities(42, new ActivityFilterDto { ActivityTypes = [type.ToLowerInvariant()], PropertyId = 10 });
        Assert.True(result.Success, result.Message);
        Assert.Equal(3, result.Data!.TotalCount);
        Assert.Equal(new[] { "Deleted", "Updated", "Created" }, result.Data.Activities.Select(a => a.Operation));
        Assert.All(result.Data.Activities, a => { Assert.Equal(17, a.OrganizationId); Assert.StartsWith("event:", a.EventKey); Assert.NotNull(a.IconType); Assert.Equal(DateTimeKind.Utc, a.CreatedAt.Kind); });
    }

    [Fact]
    public async Task Pagination_counts_all_events_beyond_legacy_cap_and_preserves_stable_ties()
    {
        await using var f = new Fixture();
        await f.Seed();
        var at = DateTime.UtcNow.AddDays(-1);
        for (var i = 1; i <= 155; i++) f.Db.ActivityEvents.Add(new ActivityEvent {
            ActivityType = "BankAccount", Operation = "Updated", OrganizationId = 17, RelatedId = i, CreatedAt = at });
        await f.Db.SaveChangesAsync();
        var seen = new HashSet<long>();
        for (var page = 1; page <= 16; page++)
        {
            var result = await f.Service.GetActivities(42, new ActivityFilterDto { ActivityTypes = ["BankAccount"], Page = page, PageSize = 10, StartDate = at, EndDate = at });
            Assert.True(result.Success, result.Message);
            Assert.Equal(155, result.Data!.TotalCount);
            Assert.Equal(page < 16, result.Data.HasMore);
            foreach (var item in result.Data.Activities) Assert.True(seen.Add(item.Id));
        }
        Assert.Equal(155, seen.Count);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task No_org_or_no_membership_is_forbidden(bool organization, bool membership)
    {
        await using var f = new Fixture();
        if (membership) await f.Seed();
        if (!organization) f.Http.Items.Remove("OrganizationId");
        var response = await f.Service.GetActivities(42, new ActivityFilterDto());
        Assert.False(response.Success);
        Assert.Equal(403, response.StatusCode);
        Assert.Null(response.Data);
    }

    [Fact]
    public async Task Main_calendar_task_mutations_reach_feed_with_durable_history()
    {
        await using var f = new Fixture();
        await f.Seed();
        var task = new LandlordTask { OrganizationId = 17, Title = "Inspection", DueDate = DateTime.UtcNow };
        f.Db.Add(task);
        await f.Db.SaveChangesAsync();
        task.Title = "Inspection updated";
        await f.Db.SaveChangesAsync();
        f.Db.Remove(task);
        await f.Db.SaveChangesAsync();
        var response = await f.Service.GetActivities(42, new ActivityFilterDto { ActivityTypes = ["Calendar"] });
        Assert.True(response.Success, response.Message);
        Assert.Equal(new[] { "Deleted", "Updated", "Created" }, response.Data!.Activities.Select(a => a.Operation));
        Assert.All(response.Data.Activities, a => Assert.Equal(task.Id, a.RelatedId));
    }

    [Fact]
    public async Task Actor_names_are_batched_and_legacy_staff_filter_alias_is_supported()
    {
        await using var f = new Fixture();
        await f.Seed();
        f.Db.Users.Add(new User { Id = 88, FirstName = "Alex", LastName = "Owner" });
        f.Db.ActivityEvents.Add(new ActivityEvent { ActivityType = "TeamMember", Operation = "Updated", OrganizationId = 17,
            PerformedByUserId = 88, PerformedByName = "User #88", CreatedAt = DateTime.UtcNow, PropertyId = 12 });
        await f.Db.SaveChangesAsync();
        var result = await f.Service.GetActivities(42, new ActivityFilterDto { ActivityTypes = ["StaffMember"], PropertyId = 12 });
        Assert.True(result.Success, result.Message);
        Assert.Equal("Alex Owner", Assert.Single(result.Data!.Activities).PerformedByName);
    }
}
