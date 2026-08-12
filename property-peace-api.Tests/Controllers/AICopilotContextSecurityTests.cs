using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.AgentFollowUpService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class AICopilotContextSecurityTests
{
    private const long ClaimUserId = 7;
    private const long OrganizationId = 23;

    [Fact]
    public async Task GetOrganizationSummary_RejectsWhenMiddlewareUserDoesNotMatchAuthenticatedClaim()
    {
        var fixture = CreateFixture(middlewareUserId: ClaimUserId + 1, databaseUser: ActiveUser());

        var result = await fixture.Controller.GetOrganizationSummary();

        AssertForbidden(result);
        fixture.Ai.VerifyNoOtherCalls();
        fixture.Users.VerifyNoOtherCalls();
        fixture.Members.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task GetOrganizationSummary_RejectsDeletedOrSuspendedDatabaseUser(bool isDeleted, bool isSuspended)
    {
        var fixture = CreateFixture(
            middlewareUserId: ClaimUserId,
            databaseUser: ActiveUser(isDeleted, isSuspended));

        var result = await fixture.Controller.GetOrganizationSummary();

        AssertForbidden(result);
        fixture.Ai.VerifyNoOtherCalls();
        fixture.Users.Verify(repository => repository.GetUser(ClaimUserId), Times.Once);
        fixture.Users.VerifyNoOtherCalls();
        fixture.Members.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetOrganizationSummary_BindsMatchingMiddlewareClaimActiveUserAndMembership()
    {
        var fixture = CreateFixture(middlewareUserId: ClaimUserId, databaseUser: ActiveUser());
        fixture.Members
            .Setup(repository => repository.GetMemberAsync(OrganizationId, ClaimUserId))
            .ReturnsAsync(new OrganizationMember { OrganizationId = OrganizationId, UserId = ClaimUserId, IsActive = true });
        fixture.Ai
            .Setup(service => service.GetOrganizationSummary(OrganizationId))
            .ReturnsAsync(ServiceResponse<OrganizationSummaryDto>.CreateSuccess(new OrganizationSummaryDto()));

        var result = await fixture.Controller.GetOrganizationSummary();

        result.Should().BeOfType<OkObjectResult>();
        fixture.Ai.Verify(service => service.GetOrganizationSummary(OrganizationId), Times.Once);
    }

    private static User ActiveUser(bool isDeleted = false, bool isSuspended = false) => new()
    {
        Id = ClaimUserId,
        Email = "active@example.test",
        IsDeleted = isDeleted,
        IsSuspended = isSuspended
    };

    private static Fixture CreateFixture(long middlewareUserId, User databaseUser)
    {
        var ai = new Mock<IAICopilotService>(MockBehavior.Strict);
        var users = new Mock<IUserRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>(MockBehavior.Strict);
        users.Setup(repository => repository.GetUser(ClaimUserId)).ReturnsAsync(databaseUser);
        members
            .Setup(repository => repository.GetMemberAsync(OrganizationId, ClaimUserId))
            .ReturnsAsync(new OrganizationMember { OrganizationId = OrganizationId, UserId = ClaimUserId, IsActive = true });
        ai
            .Setup(service => service.GetOrganizationSummary(OrganizationId))
            .ReturnsAsync(ServiceResponse<OrganizationSummaryDto>.CreateSuccess(new OrganizationSummaryDto()));

        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, ClaimUserId.ToString())], "Test"))
        };
        context.Items["UserId"] = middlewareUserId;
        context.Items["OrganizationId"] = OrganizationId;

        var controller = new AICopilotController(
            ai.Object,
            Mock.Of<IAgentFollowUpService>(),
            users.Object,
            members.Object,
            NullLogger<AICopilotController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        return new Fixture(controller, ai, users, members);
    }

    private static void AssertForbidden(IActionResult result)
    {
        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    private sealed record Fixture(
        AICopilotController Controller,
        Mock<IAICopilotService> Ai,
        Mock<IUserRepository> Users,
        Mock<IOrganizationMemberRepository> Members);
}
