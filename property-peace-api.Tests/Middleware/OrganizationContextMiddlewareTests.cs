using System.Security.Claims;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Middleware;

public sealed class OrganizationContextMiddlewareTests
{
    private const long UserId = 42;
    private const long PersistedOrganizationId = 101;
    private const long RequestedOrganizationId = 202;

    [Fact]
    public async Task WithoutHeader_UsesAuthorizedPersistedOrganization()
    {
        var fixture = CreateFixture();
        fixture.Users.Setup(x => x.GetUser(UserId)).ReturnsAsync(new User
        {
            Id = UserId,
            CurrentOrganizationId = PersistedOrganizationId
        });
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(
                UserId, PersistedOrganizationId, fixture.Context.RequestAborted))
            .ReturnsAsync(true);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["OrganizationId"].Should().Be(PersistedOrganizationId);
        fixture.Context.Items["UserId"].Should().Be(UserId);
    }

    [Fact]
    public async Task AuthorizedHeader_UsesRequestedOrganizationAndPropagatesRequestToken()
    {
        var fixture = CreateFixture(RequestedOrganizationId.ToString());
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(
                UserId, RequestedOrganizationId, fixture.Context.RequestAborted))
            .ReturnsAsync(true);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["OrganizationId"].Should().Be(RequestedOrganizationId);
        fixture.Users.Verify(x => x.GetUser(It.IsAny<long>()), Times.Never);
        fixture.Authority.VerifyAll();
    }

    [Theory]
    [InlineData("not-an-id")]
    [InlineData("0")]
    [InlineData("-1")]
    public async Task MalformedOrNonPositiveHeader_ReturnsBadRequestWithoutFallback(string header)
    {
        var fixture = CreateFixture(header);

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        fixture.NextWasCalled.Should().BeFalse();
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Authority.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task InactiveOrganizationOrMember_FromAtomicResolver_ReturnsForbidden()
    {
        var fixture = CreateFixture(RequestedOrganizationId.ToString());
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(
                UserId, RequestedOrganizationId, fixture.Context.RequestAborted))
            .ReturnsAsync(false);

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.NextWasCalled.Should().BeFalse();
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Context.Items.Should().NotContainKey("UserId");
    }

    [Fact]
    public async Task AuthorityStoreFailure_ReturnsServerErrorWithoutContinuing()
    {
        var fixture = CreateFixture(RequestedOrganizationId.ToString());
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(
                UserId, RequestedOrganizationId, fixture.Context.RequestAborted))
            .ThrowsAsync(new InvalidOperationException("membership store unavailable"));

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        fixture.NextWasCalled.Should().BeFalse();
    }

    [Fact]
    public async Task AbortedAuthorityResolution_PreservesCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var fixture = CreateFixture(RequestedOrganizationId.ToString(), cancellation.Token);
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(
                UserId, RequestedOrganizationId, cancellation.Token))
            .ThrowsAsync(new OperationCanceledException(cancellation.Token));

        var action = () => fixture.InvokeAsync();

        await action.Should().ThrowAsync<OperationCanceledException>();
        fixture.Context.Response.StatusCode.Should().NotBe(StatusCodes.Status500InternalServerError);
        fixture.NextWasCalled.Should().BeFalse();
    }

    private static Fixture CreateFixture(string? organizationHeader = null, CancellationToken requestAborted = default)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, UserId.ToString())], "Test"))
        };
        context.RequestAborted = requestAborted;
        if (organizationHeader is not null)
            context.Request.Headers["X-Organization-Id"] = organizationHeader;

        return new Fixture(context);
    }

    private sealed class Fixture
    {
        public Fixture(DefaultHttpContext context)
        {
            Context = context;
            Middleware = new OrganizationContextMiddleware(
                _ =>
                {
                    NextWasCalled = true;
                    return Task.CompletedTask;
                },
                NullLogger<OrganizationContextMiddleware>.Instance);
        }

        public DefaultHttpContext Context { get; }
        public Mock<IUserRepository> Users { get; } = new();
        public Mock<IOrganizationAuthorityResolver> Authority { get; } = new(MockBehavior.Strict);
        public OrganizationContextMiddleware Middleware { get; }
        public bool NextWasCalled { get; private set; }

        public Task InvokeAsync() => Middleware.InvokeAsync(Context, Users.Object, Authority.Object);
    }
}
