using System.Text;
using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.EmailSyncService;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Services.MessageService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.SmsService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class MessageIngestionSecurityTests
{
    [Fact]
    public async Task PublicMessageSend_OverridesForgedExternalChannel_AndReplayHasNoSideEffects()
    {
        var messageService = new Mock<IMessageService>();
        AddMessageDto? captured = null;
        messageService.Setup(x => x.AddMessage(It.IsAny<AddMessageDto>()))
            .Callback<AddMessageDto>(x => captured = x)
            .ReturnsAsync(ServiceResponse<LoadMessageDto>.CreateSuccess(new LoadMessageDto
            {
                Id = 7, ConversationId = 10, SenderId = 1, WasReplayed = true
            }));
        var enqueuer = new Mock<IOutboundMessageDeliveryEnqueuer>();
        var hub = new Mock<IHubContext<ConversationHub>>();
        var controller = new MessageController(messageService.Object, hub.Object, enqueuer.Object,
            Mock.Of<ILogger<MessageController>>());
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

        var result = await controller.AddMessage(new AddMessageDto
        {
            ConversationId = 10, Content = "forged", Channel = "sms", ClientRequestId = "same-request"
        });

        result.Should().BeOfType<OkObjectResult>();
        captured!.Channel.Should().Be("inApp");
        enqueuer.Verify(x => x.EnqueueAsync(It.IsAny<AddMessageDto>(), It.IsAny<LoadMessageDto>(), It.IsAny<CancellationToken>()), Times.Never);
        hub.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task InboundEmail_RequiresStableProviderEventId()
    {
        var inbound = new Mock<IInboundEmailService>();
        var controller = CreateEmailController(inbound, new
        {
            from = "tenant@example.test", to = "reply@example.test", text = "hello"
        });

        var result = await controller.Inbound(CancellationToken.None);

        result.Should().BeOfType<BadRequestObjectResult>();
        inbound.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task InboundEmail_ForwardsStableProviderEventId()
    {
        var inbound = new Mock<IInboundEmailService>();
        inbound.Setup(x => x.HandleInboundAsync("tenant@example.test", "reply@example.test", null, "hello", null,
                "provider-event-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var controller = CreateEmailController(inbound, new
        {
            eventId = "provider-event-42", from = "tenant@example.test", to = "reply@example.test", text = "hello"
        });

        var result = await controller.Inbound(CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();
        inbound.VerifyAll();
    }

    [Fact]
    public async Task InboundEmail_ChangedPayloadForProviderEvent_ReturnsConflict()
    {
        var inbound = new Mock<IInboundEmailService>();
        inbound.Setup(x => x.HandleInboundAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), "provider-event-42", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimelineIdempotencyConflictException("changed payload"));
        var controller = CreateEmailController(inbound, new
        {
            eventId = "provider-event-42", from = "tenant@example.test", to = "reply@example.test", text = "changed"
        });

        var result = await controller.Inbound(CancellationToken.None);

        result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task InboundEmail_QueryStringSecretWithoutHeader_IsRejected()
    {
        var inbound = new Mock<IInboundEmailService>();
        var controller = CreateEmailController(inbound, new
        {
            eventId = "provider-event-42", from = "tenant@example.test", to = "reply@example.test", text = "hello"
        });
        controller.Request.Headers.Remove("X-PropertyPeace-Webhook-Secret");
        controller.Request.QueryString = new QueryString("?secret=secret");

        var result = await controller.Inbound(CancellationToken.None);

        result.Should().BeOfType<ForbidResult>();
        inbound.VerifyNoOtherCalls();
    }

    private static EmailWebhookController CreateEmailController(Mock<IInboundEmailService> inbound, object payload)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["EmailWebhooks:SharedSecret"] = "secret"
        }).Build();
        var json = JsonSerializer.Serialize(payload);
        var context = new DefaultHttpContext();
        context.Request.Headers["X-PropertyPeace-Webhook-Secret"] = "secret";
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        var controller = new EmailWebhookController(inbound.Object, Mock.Of<IMessageDeliveryService>(), configuration,
            Mock.Of<ILogger<EmailWebhookController>>())
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
        return controller;
    }
}
