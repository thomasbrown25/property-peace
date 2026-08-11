using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.AgentFollowUpService;
using brownstone_hub_api.Services.PercyActions;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class AICopilotCollectionsContainmentTests
{
    [Fact]
    public async Task ForceFollowUp_ReturnsStableConfirmationRequiredResponse_WithoutExecutingAgentService()
    {
        var agent = new Mock<IAgentFollowUpService>(MockBehavior.Strict);
        var controller = new AICopilotController(
            Mock.Of<IAICopilotService>(),
            agent.Object,
            Mock.Of<IUserRepository>(),
            Mock.Of<IOrganizationMemberRepository>(),
            NullLogger<AICopilotController>.Instance);

        var result = await controller.ForceFollowUp(
            42,
            new AICopilotController.ForceFollowUpRequest { TenantIds = [7, 8] },
            CancellationToken.None);

        var blocked = result.Should().BeOfType<ObjectResult>().Subject;
        blocked.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var body = JsonSerializer.SerializeToElement(blocked.Value);
        body.GetProperty("code").GetString().Should().Be("percy_action_unavailable");
        body.GetProperty("actionType").GetString().Should().Be(PercyActionTypes.CollectionsForceFollowUp);
        body.GetProperty("confirmationRequired").GetBoolean().Should().BeTrue();
        body.GetProperty("executionEnabled").GetBoolean().Should().BeFalse();
        body.GetProperty("message").GetString().Should().Be(
            "No follow-up was sent. This action requires organization-scoped Percy confirmation execution, which is not enabled yet.");
        agent.VerifyNoOtherCalls();
    }
}
