using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.StripeService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeWebhookControllerSecurityTests
{
    [Fact]
    public async Task HandleWebhook_DoesNotLogSensitiveRequestHeaders()
    {
        var messages = new List<string>();
        var logger = new Mock<ILogger<StripeWebhookController>>();
        logger.Setup(x => x.Log(
                It.IsAny<LogLevel>(), It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((_, _) => true), It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
            .Callback(new InvocationAction(invocation => messages.Add(invocation.Arguments[2]?.ToString() ?? string.Empty)));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();
        await using var context = Services.StripeRentPayments.StripeRentPaymentFlowTests.CreateContext();
        var controller = new StripeWebhookController(Mock.Of<IStripeWebhookService>(), logger.Object, configuration, context)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.Request.Method = "POST";
        controller.Request.Headers["Stripe-Signature"] = "sensitive-signature-value";
        controller.Request.Headers.Authorization = "Bearer sensitive-token";
        controller.Request.Headers.Cookie = "session=sensitive-cookie";

        await controller.HandleWebhook();

        string.Join("\n", messages).Should().NotContain("sensitive-signature-value");
        string.Join("\n", messages).Should().NotContain("sensitive-token");
        string.Join("\n", messages).Should().NotContain("sensitive-cookie");
    }
}
