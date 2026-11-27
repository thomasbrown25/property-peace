using System.Reflection;
using System.Text.RegularExpressions;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class DashboardSetupDismissalControllerTests
{
    [Fact]
    public void RoutesRequireLandlordDashboardAuthorization()
    {
        var controller = typeof(DashboardSetupDismissalController);
        Assert.Equal("api/dashboard/online-payments-setup-dismissal", controller.GetCustomAttribute<RouteAttribute>()?.Template);
        Assert.Equal("Landlord,Admin", controller.GetCustomAttribute<AuthorizeAttribute>()?.Roles);
        Assert.NotNull(controller.GetMethod(nameof(DashboardSetupDismissalController.GetDismissal))?.GetCustomAttribute<HttpGetAttribute>());
        Assert.NotNull(controller.GetMethod(nameof(DashboardSetupDismissalController.Dismiss))?.GetCustomAttribute<HttpPutAttribute>());
    }

    [Theory]
    [InlineData(41L, null)]
    [InlineData(null, 7L)]
    public async Task ReadsAndWritesRequireVerifiedUserAndOrganization(long? userId, long? organizationId)
    {
        var repository = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        var controller = Controller(repository.Object, userId, organizationId);
        controller.Request.Headers["X-Organization-Id"] = "7";

        Assert.IsType<ForbidResult>(await controller.GetDismissal(default));
        Assert.IsType<ForbidResult>(await controller.Dismiss(default));
    }

    [Fact]
    public async Task DismissalSurvivesNewRequestsAndIsIsolatedToTheActiveMembership()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options;
        await using var db = new DataContext(options);
        var schema = db.Database.GenerateCreateScript();
        foreach (var table in new[] { "Organizations", "OrganizationMembers", "ActivityEvents" })
        {
            var statement = Regex.Match(schema, $"CREATE TABLE \"{table}\"[^;]*;", RegexOptions.Singleline);
            Assert.True(statement.Success, $"Missing table {table} in model");
            await db.Database.ExecuteSqlRawAsync(statement.Value);
        }

        db.Organizations.AddRange(
            new Organization { Id = 7, Name = "First" },
            new Organization { Id = 8, Name = "Second" });
        db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 7, UserId = 41 },
            new OrganizationMember { Id = 2, OrganizationId = 7, UserId = 42 },
            new OrganizationMember { Id = 3, OrganizationId = 8, UserId = 41 },
            new OrganizationMember { Id = 4, OrganizationId = 7, UserId = 43, IsActive = false });
        await db.SaveChangesAsync();

        var writer = Controller(Repository(db), 41, 7);
        AssertDismissed(await writer.GetDismissal(default), false);
        Assert.IsType<NoContentResult>(await writer.Dismiss(default));
        Assert.IsType<NoContentResult>(await writer.Dismiss(default));

        // Updating membership details with an older tracked entity must preserve the dismissal.
        var staleMember = db.OrganizationMembers.Local.Single(member => member.Id == 1);
        staleMember.Role = "Manager";
        await Repository(db).UpdateMemberAsync(staleMember);

        await using var freshDb = new DataContext(options);
        var reader = Repository(freshDb);
        AssertDismissed(await Controller(reader, 41, 7).GetDismissal(default), true);
        AssertDismissed(await Controller(reader, 42, 7).GetDismissal(default), false);
        AssertDismissed(await Controller(reader, 41, 8).GetDismissal(default), false);

        Assert.IsType<ForbidResult>(await Controller(reader, 43, 7).Dismiss(default));
        Assert.IsType<ForbidResult>(await Controller(reader, 44, 7).GetDismissal(default));
    }

    private static void AssertDismissed(IActionResult result, bool expected) =>
        Assert.Equivalent(new { Dismissed = expected }, Assert.IsType<OkObjectResult>(result).Value);

    private static OrganizationMemberRepository Repository(DataContext db) =>
        new(db, NullLogger<OrganizationMemberRepository>.Instance);

    private static DashboardSetupDismissalController Controller(IOrganizationMemberRepository repository, long? userId, long? organizationId)
    {
        var context = new DefaultHttpContext();
        if (userId.HasValue) context.Items["UserId"] = userId.Value;
        if (organizationId.HasValue) context.Items["OrganizationId"] = organizationId.Value;

        return new DashboardSetupDismissalController(repository) { ControllerContext = new ControllerContext { HttpContext = context } };
    }
}
