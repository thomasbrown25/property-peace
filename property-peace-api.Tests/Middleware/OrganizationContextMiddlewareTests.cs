using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Middleware;

public sealed class OrganizationContextMiddlewareTests
{
    private const long UserId = 42;
    private const long PersistedOrganizationId = 101;
    private const long RequestedOrganizationId = 202;

    [Theory]
    [InlineData(nameof(TenantDocumentController.GetDocumentsByTenant), PersistedOrganizationId, null, true, true)]
    [InlineData(nameof(TenantDocumentController.GetDocumentsByTenant), RequestedOrganizationId, null, true, false)]
    [InlineData(nameof(TenantDocumentController.GetLeaseAgreement), PersistedOrganizationId, null, true, true)]
    [InlineData(nameof(TenantDocumentController.GetLeaseAgreement), PersistedOrganizationId, null, false, false)]
    [InlineData(nameof(TenantDocumentController.GetLeaseAgreement), RequestedOrganizationId, null, true, false)]
    [InlineData(nameof(TenantDocumentController.GetLeaseAgreement), PersistedOrganizationId, "Landlord", true, false)]
    [InlineData(nameof(TenantDocumentController.GetDocumentsByTenant), PersistedOrganizationId, "Admin", true, false)]
    public async Task DocumentReadsUseLeaseAuthorityOnlyForTenantPortalUsers(
        string action, long organizationId, string? staffRole, bool ownsLease, bool allowed)
    {
        const long leaseId = 136;
        var fixture = CreateFixture(organizationId.ToString());
        var method = typeof(TenantDocumentController).GetMethod(action)!;
        var attributes = method.GetCustomAttributes(true);
        var route = attributes.OfType<HttpGetAttribute>().Single().Template;
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse($"api/TenantDocument/{route}"), 0,
            new EndpointMetadataCollection(attributes), action));
        if (action == nameof(TenantDocumentController.GetLeaseAgreement))
            fixture.Context.Request.RouteValues["leaseId"] = leaseId;

        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(UserId, organizationId, fixture.Context.RequestAborted))
            .ReturnsAsync(false);
        if (staffRole is not null)
        {
            ((ClaimsIdentity)fixture.Context.User.Identity!).AddClaim(new Claim(ClaimTypes.Role, staffRole));
        }
        else
        {
            fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
                .ReturnsAsync([PersistedOrganizationId]);
            fixture.Authority.Setup(x => x.HasTenantLeaseInOrganizationAsync(
                    UserId, leaseId, PersistedOrganizationId, fixture.Context.RequestAborted))
                .ReturnsAsync(ownsLease);
        }

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().Be(allowed);
        if (allowed)
        {
            fixture.Context.Items["OrganizationId"].Should().Be(organizationId);
            fixture.Context.Items["UserId"].Should().Be(UserId);
        }
        else
        {
            fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
            fixture.Context.Items.Should().NotContainKey("OrganizationId");
        }
        if (staffRole is null)
            fixture.Authority.Verify(x => x.HasActiveMembershipAsync(UserId, organizationId, fixture.Context.RequestAborted), Times.Never);
        else
            fixture.Authority.Verify(x => x.HasActiveMembershipAsync(UserId, organizationId, fixture.Context.RequestAborted), Times.Once);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("Landlord", false)]
    [InlineData("Admin", false)]
    public async Task TenantOnlyOptionalOrganizationPreservesMembershipForOtherPortalRoles(string? otherRole, bool allowed)
    {
        var fixture = CreateFixture("101");
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/subscription/status"), 0,
            new EndpointMetadataCollection(new OrganizationContextOptionalAttribute(tenantOnly: true)), "subscription status"));
        if (otherRole is not null)
        {
            ((ClaimsIdentity)fixture.Context.User.Identity!).AddClaim(new Claim(ClaimTypes.Role, otherRole));
            fixture.Authority.Setup(x => x.HasActiveMembershipAsync(UserId, PersistedOrganizationId, fixture.Context.RequestAborted))
                .ReturnsAsync(false);
        }

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().Be(allowed);
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        if (allowed) fixture.Context.Items["UserId"].Should().Be(UserId);
        else fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Theory]
    [InlineData("/notificationHub")]
    [InlineData("/notificationHub/negotiate")]
    public async Task NotificationHubUsesAuthenticatedUserWithoutOrganizationMembership(string path)
    {
        var fixture = CreateFixture("101");
        await using var app = CreateHubEndpoints<NotificationHub>("/notificationHub");
        fixture.Context.SetEndpoint(GetHubEndpoint(app, path));

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["UserId"].Should().Be(UserId);
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Authority.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("/conversationHub")]
    [InlineData("/conversationHub/negotiate")]
    public async Task ConversationHubUsesLeaseOrganizationForTenantWithoutTeamMembership(string path)
    {
        var fixture = CreateFixture();
        await using var app = CreateHubEndpoints<ConversationHub>("/conversationHub");
        fixture.Context.SetEndpoint(GetHubEndpoint(app, path));
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
            .ReturnsAsync([PersistedOrganizationId]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["UserId"].Should().Be(UserId);
        fixture.Context.Items["OrganizationId"].Should().Be(PersistedOrganizationId);
    }

    [Theory]
    [InlineData(PersistedOrganizationId, PersistedOrganizationId)]
    [InlineData(303L, null)]
    public async Task HeaderlessConversationHubOnlyUsesPersistedOrganizationWhenVerifiedByALease(long persistedId, long? expectedOrg)
    {
        var fixture = CreateFixture();
        await using var app = CreateHubEndpoints<ConversationHub>("/conversationHub");
        fixture.Context.SetEndpoint(GetHubEndpoint(app, "/conversationHub/negotiate"));
        fixture.Users.Setup(x => x.GetUser(UserId)).ReturnsAsync(new User { Id = UserId, CurrentOrganizationId = persistedId });
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
            .ReturnsAsync([PersistedOrganizationId, RequestedOrganizationId]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["UserId"].Should().Be(UserId);
        fixture.Context.Items["OrganizationId"].Should().Be(expectedOrg);
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("202", false)]
    public async Task ConversationHubWithoutALeaseAllowsOnlyPersonalConnectionWithoutAnExplicitOrganization(string? header, bool allowed)
    {
        var fixture = CreateFixture(header);
        await using var app = CreateHubEndpoints<ConversationHub>("/conversationHub");
        fixture.Context.SetEndpoint(GetHubEndpoint(app, "/conversationHub/negotiate"));
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
            .ReturnsAsync([]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().Be(allowed);
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        if (allowed) fixture.Context.Items["UserId"].Should().Be(UserId);
        else
        {
            fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
            fixture.Context.Items.Should().NotContainKey("UserId");
        }
    }

    [Fact]
    public async Task ConversationHubStillRequiresMembershipForTenantWithALandlordRole()
    {
        var fixture = CreateFixture("101");
        ((ClaimsIdentity)fixture.Context.User.Identity!).AddClaim(new Claim(ClaimTypes.Role, "Landlord"));
        await using var app = CreateHubEndpoints<ConversationHub>("/conversationHub");
        fixture.Context.SetEndpoint(GetHubEndpoint(app, "/conversationHub/negotiate"));
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(UserId, PersistedOrganizationId, fixture.Context.RequestAborted))
            .ReturnsAsync(false);

        await fixture.InvokeAsync();

        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.NextWasCalled.Should().BeFalse();
    }

    [Theory]
    [InlineData("Viewer", false)]
    [InlineData("Manager", true)]
    [InlineData("Owner", true)]
    public async Task ManualPaymentWriteRequiresRoleInSelectedOrganization(string role, bool allowed)
    {
        var fixture = CreateFixture("101");
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/payment"), 0,
            new EndpointMetadataCollection(new ManualPaymentWriteAttribute()), "manual payment"));
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(UserId, 101, fixture.Context.RequestAborted)).ReturnsAsync(true);
        fixture.Authority.Setup(x => x.ResolveActiveMemberAsync(UserId, 101, fixture.Context.RequestAborted))
            .ReturnsAsync(new OrganizationMember { UserId = UserId, OrganizationId = 101, Role = role });
        await fixture.InvokeAsync();
        fixture.NextWasCalled.Should().Be(allowed);
        if (!allowed) fixture.Context.Response.StatusCode.Should().Be(403);
    }

    [Theory]
    [InlineData(null, 101L, true)]
    [InlineData("101", 101L, true)]
    [InlineData("202", null, false)]
    public async Task TenantSelfPaymentRoute_UsesOnlyVerifiedLeaseOrganization(string? header, long? expectedOrg, bool allowed)
    {
        var fixture = CreateFixture(header);
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/feature-readiness/rent-payments/pay"), 0,
            new EndpointMetadataCollection(new TenantSelfOrganizationAttribute()), "tenant pay"));
        fixture.Users.Setup(x => x.GetUser(UserId)).ReturnsAsync(new User { Id = UserId, CurrentOrganizationId = 202 });
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
            .ReturnsAsync([101L]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().Be(allowed);
        if (allowed) fixture.Context.Items["OrganizationId"].Should().Be(expectedOrg);
        else fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Authority.Verify(x => x.HasActiveMembershipAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task TenantSelfLeaseRoute_WithoutHeaderAllowsControllerOwnedScopeWithoutOrganization()
    {
        var fixture = CreateFixture();
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/lease/tenant/my-leases"), 0,
            new EndpointMetadataCollection(new TenantSelfOrganizationAttribute(allowWithoutOrganization: true)), "tenant leases"));
        await fixture.InvokeAsync();
        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
    }

    [Fact]
    public async Task TenantSelfPaymentRoute_MultipleLeaseOrganizationsRequiresExplicitHeader()
    {
        var fixture = CreateFixture();
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/stripe/create-payment-intent"), 0,
            new EndpointMetadataCollection(new TenantSelfOrganizationAttribute()), "tenant stripe"));
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted))
            .ReturnsAsync([101L, 202L]);
        await fixture.InvokeAsync();
        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.NextWasCalled.Should().BeFalse();
    }

    [Fact]
    public async Task UnmarkedManualPaymentRoute_DoesNotGrantTenantMembership()
    {
        var fixture = CreateFixture("101");
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/payment"), 0, EndpointMetadataCollection.Empty, "manual payment"));
        fixture.Authority.Setup(x => x.HasActiveMembershipAsync(UserId, 101, fixture.Context.RequestAborted)).ReturnsAsync(false);
        await fixture.InvokeAsync();
        fixture.Context.Response.StatusCode.Should().Be(403);
        fixture.NextWasCalled.Should().BeFalse();
        fixture.Authority.Verify(x => x.GetTenantLeaseOrganizationIdsAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task TenantSelfHistory_RejectsOtherLeaseEvenWithinVerifiedOrganization()
    {
        var fixture = CreateFixture("101");
        fixture.Context.Request.RouteValues["leaseId"] = "555";
        fixture.Context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/payment/{leaseId}/tenant-history"), 0,
            new EndpointMetadataCollection(new TenantSelfOrganizationAttribute(true)), "history"));
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(UserId, fixture.Context.RequestAborted)).ReturnsAsync([101L]);
        fixture.Authority.Setup(x => x.HasTenantLeaseInOrganizationAsync(UserId, 555, 101, fixture.Context.RequestAborted)).ReturnsAsync(false);
        await fixture.InvokeAsync();
        fixture.Context.Response.StatusCode.Should().Be(403);
        fixture.NextWasCalled.Should().BeFalse();
    }

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

    private static WebApplication CreateHubEndpoints<THub>(string path) where THub : Hub
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddSignalR();
        var app = builder.Build();
        app.MapHub<THub>(path);
        return app;
    }

    private static Endpoint GetHubEndpoint(WebApplication app, string path) => ((IEndpointRouteBuilder)app)
        .DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>()
        .Single(endpoint => endpoint.RoutePattern.RawText == path);

    private static Fixture CreateFixture(string? organizationHeader = null, CancellationToken requestAborted = default)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, UserId.ToString()), new Claim(ClaimTypes.Role, "Tenant")], "Test"))
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
