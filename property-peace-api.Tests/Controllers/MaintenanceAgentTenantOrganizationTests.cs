using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceAgent;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.MaintenanceAgentService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class MaintenanceAgentTenantOrganizationTests
{
    private const long TenantUserId = 42;
    private const long LeaseOrganizationId = 101;
    private const long OtherOrganizationId = 202;

    [Fact]
    public async Task Chat_AllowsTenantWithLeaseAuthorityWithoutOrganizationMembership()
    {
        var fixture = CreateFixture(LeaseOrganizationId);
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(TenantUserId, fixture.Context.RequestAborted))
            .ReturnsAsync([LeaseOrganizationId]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeTrue();
        fixture.Context.Items["OrganizationId"].Should().Be(LeaseOrganizationId);
        fixture.Authority.Verify(x => x.HasActiveMembershipAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Chat_RejectsTenantLeaseAuthorityForAnotherOrganization()
    {
        var fixture = CreateFixture(OtherOrganizationId);
        fixture.Authority.Setup(x => x.GetTenantLeaseOrganizationIdsAsync(TenantUserId, fixture.Context.RequestAborted))
            .ReturnsAsync([LeaseOrganizationId]);

        await fixture.InvokeAsync();

        fixture.NextWasCalled.Should().BeFalse();
        fixture.Context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Context.Items.Should().NotContainKey("OrganizationId");
        fixture.Authority.Verify(x => x.HasActiveMembershipAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Chat_PassesMiddlewareValidatedOrganizationToAgent()
    {
        var agent = new Mock<IMaintenanceAgentService>(MockBehavior.Strict);
        var messages = new List<MaintenanceAgentMessageDto> { new() { Role = "user", Content = "The faucet leaks." } };
        agent.Setup(x => x.ChatAsync(messages, LeaseOrganizationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MaintenanceAgentChatResponseDto { Message = "What room is affected?" });
        using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(nameof(Chat_PassesMiddlewareValidatedOrganizationToAgent)).Options);
        var controller = new MaintenanceAgentController(agent.Object, new Mock<IUserRepository>().Object, db,
            NullLogger<MaintenanceAgentController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Items["OrganizationId"] = LeaseOrganizationId;

        var result = await controller.Chat(new MaintenanceAgentChatRequestDto { Messages = messages }, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();
        agent.Verify(x => x.ChatAsync(messages, LeaseOrganizationId, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static Fixture CreateFixture(long selectedOrganizationId)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, TenantUserId.ToString()), new Claim(ClaimTypes.Role, "Tenant")], "Test"))
        };
        context.Request.Headers["X-Organization-Id"] = selectedOrganizationId.ToString();

        var action = typeof(MaintenanceAgentController).GetMethod(nameof(MaintenanceAgentController.Chat))!;
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/maintenance-agent/chat"), 0,
            new EndpointMetadataCollection(action.GetCustomAttributes(true)), "maintenance agent chat"));

        return new Fixture(context);
    }

    private sealed class Fixture(DefaultHttpContext context)
    {
        public DefaultHttpContext Context { get; } = context;
        public Mock<IUserRepository> Users { get; } = new();
        public Mock<IOrganizationAuthorityResolver> Authority { get; } = new(MockBehavior.Strict);
        public bool NextWasCalled { get; private set; }

        public Task InvokeAsync() => new OrganizationContextMiddleware(
            _ =>
            {
                NextWasCalled = true;
                return Task.CompletedTask;
            },
            NullLogger<OrganizationContextMiddleware>.Instance)
            .InvokeAsync(Context, Users.Object, Authority.Object);
    }
}
