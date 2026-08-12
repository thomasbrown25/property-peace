using brownstone_hub_api.Attributes;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
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

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        fixture.ResultStatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Authority.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("Viewer", 403)]
    [InlineData("SuperOwner", 403)]
    [InlineData("3", 403)]
    [InlineData("Manager", null)]
    [InlineData("Owner", null)]
    public async Task PersistedRoles_AreKnownAndApplyHierarchy(string role, int? expectedStatus)
    {
        var fixture = CreateFixture(role, allowedRoles: ["Manager"]);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().Be(expectedStatus is null);
        fixture.ResultStatusCode.Should().Be(expectedStatus);
    }

    [Theory]
    [InlineData("SuperOwner")]
    [InlineData("2")]
    [InlineData("")]
    public async Task UnknownOrNumericRoleRequirement_FailsClosed(string requiredRole)
    {
        var fixture = CreateFixture("Owner", allowedRoles: [requiredRole]);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        fixture.ResultStatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        fixture.Authority.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task AtomicResolverReturningNull_ForInactiveOrganizationOrMember_IsForbidden()
    {
        var fixture = CreateFixture(memberRole: null);

        await fixture.InvokeAsync();

        fixture.ResultStatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.NextCalled.Should().BeFalse();
    }

    [Fact]
    public async Task AuthorityStoreFailure_IsConvertedToServerError()
    {
        var fixture = CreateFixture("Owner");
        fixture.Authority.Reset();
        fixture.Authority.Setup(x => x.ResolveActiveMemberAsync(
                UserId, OrganizationId, fixture.Context.HttpContext.RequestAborted))
            .ThrowsAsync(new InvalidOperationException("store unavailable"));

        await fixture.InvokeAsync();

        fixture.ResultStatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        fixture.NextCalled.Should().BeFalse();
    }

    [Fact]
    public async Task AbortedAuthorityResolution_PreservesCancellationAndToken()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var fixture = CreateFixture("Owner", requestAborted: cancellation.Token);
        fixture.Authority.Reset();
        fixture.Authority.Setup(x => x.ResolveActiveMemberAsync(UserId, OrganizationId, cancellation.Token))
            .ThrowsAsync(new OperationCanceledException(cancellation.Token));

        var action = () => fixture.InvokeAsync();

        await action.Should().ThrowAsync<OperationCanceledException>();
        fixture.ResultStatusCode.Should().BeNull();
        fixture.NextCalled.Should().BeFalse();
    }

    [Fact]
    public async Task DownstreamActionException_PropagatesToGlobalHandler()
    {
        var fixture = CreateFixture("Owner");
        var expected = new InvalidOperationException("action failed");

        var action = () => fixture.InvokeAsync(() => Task.FromException<ActionExecutedContext>(expected));

        (await action.Should().ThrowAsync<InvalidOperationException>()).Which.Should().BeSameAs(expected);
        fixture.Context.Result.Should().BeNull();
    }

    private static Fixture CreateFixture(
        string? memberRole,
        bool includeContext = true,
        string[]? allowedRoles = null,
        CancellationToken requestAborted = default)
    {
        var authority = new Mock<IOrganizationAuthorityResolver>(MockBehavior.Strict);
        authority.Setup(x => x.ResolveActiveMemberAsync(UserId, OrganizationId, requestAborted))
            .ReturnsAsync(memberRole is null ? null : new OrganizationMember
            {
                OrganizationId = OrganizationId,
                UserId = UserId,
                Role = memberRole,
                IsActive = true
            });

        var users = new Mock<IUserRepository>();
        var services = new ServiceCollection()
            .AddSingleton(users.Object)
            .AddSingleton(authority.Object)
            .AddSingleton<ILogger<RequireOrganizationRoleAttribute>>(
                NullLogger<RequireOrganizationRoleAttribute>.Instance)
            .BuildServiceProvider();
        var httpContext = new DefaultHttpContext
        {
            RequestServices = services,
            RequestAborted = requestAborted
        };
        if (includeContext)
        {
            httpContext.Items["OrganizationId"] = OrganizationId;
            httpContext.Items["UserId"] = UserId;
        }

        var actionContext = new ActionContext(
            httpContext,
            new RouteData(),
            new ActionDescriptor(),
            new ModelStateDictionary());
        var executingContext = new ActionExecutingContext(
            actionContext,
            [],
            new Dictionary<string, object?>(),
            new object());
        return new Fixture(
            executingContext,
            authority,
            new RequireOrganizationRoleAttribute(allowedRoles ?? ["Owner", "Manager"]));
    }

    private sealed class Fixture(
        ActionExecutingContext context,
        Mock<IOrganizationAuthorityResolver> authority,
        RequireOrganizationRoleAttribute attribute)
    {
        public RequireOrganizationRoleAttribute Attribute { get; } = attribute;
        public ActionExecutingContext Context { get; } = context;
        public Mock<IOrganizationAuthorityResolver> Authority { get; } = authority;
        public bool NextCalled { get; private set; }
        public int? ResultStatusCode => (Context.Result as ObjectResult)?.StatusCode;

        public Task InvokeAsync(Func<Task<ActionExecutedContext>>? next = null) =>
            Attribute.OnActionExecutionAsync(Context, next is null ? Next : () =>
            {
                NextCalled = true;
                return next();
            });

        private Task<ActionExecutedContext> Next()
        {
            NextCalled = true;
            return Task.FromResult(new ActionExecutedContext(Context, [], new object()));
        }
    }
}
