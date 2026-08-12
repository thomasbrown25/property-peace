using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class SubscriptionControllerTrialTests
{
    [Fact]
    public async Task StartTrial_ReturnsStableGoneWithoutInvokingSubscriptionService()
    {
        var subscriptions = new Mock<ISubscriptionService>(MockBehavior.Strict);
        var controller = new SubscriptionController(
            subscriptions.Object,
            Mock.Of<ILogger<SubscriptionController>>());

        var result = await controller.StartTrial();

        var gone = result.Should().BeOfType<ObjectResult>().Subject;
        gone.StatusCode.Should().Be(StatusCodes.Status410Gone);
        gone.Value.Should().BeEquivalentTo(new { Message = "Trials are no longer available." });
        subscriptions.VerifyNoOtherCalls();
    }
}
