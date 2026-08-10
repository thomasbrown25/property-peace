using brownstone_hub_api.Attributes;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class RequireOrganizationRoleAttributeTests
{
    private const long OrganizationId = 71;
    private const long UserId = 42;

    [Fact]
    public async Task ForgedQueryOrganizationWithoutValidatedMiddlewareContext_IsRejected()
    {
        var fixture = CreateFixture("Owner", includeContext: false);
        fixture.Context.HttpContext.Request.QueryString = new QueryString($"?organizationId={OrganizationId}");

        await fixture.Attribute.OnActionExecutionAsync(fixture.Context, fixture.Next);

        fixture.NextCalled.Should().BeFalse();
        fixture.ResultStatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Members.Verify(x => x.GetMemberAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task ViewerInActiveOrganization_IsForbidden()
    {
        var fixture = CreateFixture("Viewer");

        await fixture.Attribute.OnActionExecutionAsync(fixture.Context, fixture.Next);

        fixture.NextCalled.Should().BeFalse();
        fixture.ResultStatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Theory]
    [InlineData("Owner")]
    [InlineData("Manager")]
    [InlineData("manager")]
    public async Task AllowedActiveOrganizationRole_ContinuesPipeline(string role)
    {
        var fixture = CreateFixture(role);

        await fixture.Attribute.OnActionExecutionAsync(fixture.Context, fixture.Next);

        fixture.NextCalled.Should().BeTrue();
        fixture.Context.Result.Should().BeNull();
    }

    private static Fixture CreateFixture(string role, bool includeContext = true)
    {
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        members.Setup(x => x.GetMemberAsync(OrganizationId, UserId)).ReturnsAsync(new OrganizationMember
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Role = role,
            IsActive = true
        });

        var users = new Mock<IUserRepository>();
        var services = new ServiceCollection()
            .AddSingleton(members.Object)
            .AddSingleton(users.Object)
            .AddSingleton<ILogger<RequireOrganizationRoleAttribute>>(NullLogger<RequireOrganizationRoleAttribute>.Instance)
            .BuildServiceProvider();
        var httpContext = new DefaultHttpContext { RequestServices = services };
        if (includeContext)
        {
            httpContext.Items["OrganizationId"] = OrganizationId;
            httpContext.Items["UserId"] = UserId;
        }

        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor(), new ModelStateDictionary());
        var executingContext = new ActionExecutingContext(actionContext, [], new Dictionary<string, object?>(), new object());
        return new Fixture(executingContext, members);
    }

    private sealed class Fixture(ActionExecutingContext context, Mock<IOrganizationMemberRepository> members)
    {
        public RequireOrganizationRoleAttribute Attribute { get; } = new("Owner", "Manager");
        public ActionExecutingContext Context { get; } = context;
        public Mock<IOrganizationMemberRepository> Members { get; } = members;
        public bool NextCalled { get; private set; }
        public int? ResultStatusCode => (Context.Result as ObjectResult)?.StatusCode;

        public Task<ActionExecutedContext> Next()
        {
            NextCalled = true;
            return Task.FromResult(new ActionExecutedContext(Context, [], new object()));
        }
    }
}
