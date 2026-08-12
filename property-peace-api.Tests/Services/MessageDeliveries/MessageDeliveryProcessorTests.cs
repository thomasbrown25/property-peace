using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Services.SmsService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.MessageDeliveries;

public sealed class MessageDeliveryProcessorTests
{
    [Fact]
    public async Task ProcessDue_DecryptsImmutableSnapshot_AndRecordsRealSubmissionIdentity()
    {
        var lease = Guid.Empty;
        var row = new MessageDelivery
        {
            Id = 9, Channel = MessageDeliveryChannel.Sms, BodySnapshot = "original body",
            ProtectedDestination = "p:+14155550123", ProtectedFromAddress = "p:+14155550999", AttemptCount = 1,
            IdempotencyKey = "stable-delivery-token"
        };
        var service = new Mock<IMessageDeliveryService>();
        service.Setup(x => x.LeaseDueAsync(25, It.IsAny<Guid>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<int, Guid, TimeSpan, CancellationToken>((_, id, _, _) => lease = id)
            .ReturnsAsync([row]);
        service.Setup(x => x.RecordSubmittedAsync(9, It.IsAny<Guid?>(), "twilio", "SM-real", It.IsAny<CancellationToken>()))
            .ReturnsAsync(row);
        service.Setup(x => x.RecordSubmissionStartedAsync(9, It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(row);
        var sms = new Mock<ISmsService>();
        sms.Setup(x => x.SubmitSmsAsync("+14155550123", "original body", It.IsAny<CancellationToken>(), "+14155550777",
                "stable-delivery-token"))
            .ReturnsAsync(new SmsSubmissionResult(true, "twilio", "SM-real"));
        var security = new Mock<IOutboundSmsSecurityService>();
        security.Setup(x => x.AuthorizeDeliveryAsync(9, It.IsAny<CancellationToken>()))
            .ReturnsAsync(OutboundSmsSecurityDecision.Allowed("+14155550777"));
        var processor = new MessageDeliveryProcessor(service.Object, new Protector(), sms.Object, security.Object,
            Mock.Of<IEmailService>(), Mock.Of<ILogger<MessageDeliveryProcessor>>());

        (await processor.ProcessDueAsync()).Should().Be(1);

        lease.Should().NotBe(Guid.Empty);
        service.Verify(x => x.RecordSubmittedAsync(9, lease, "twilio", "SM-real", It.IsAny<CancellationToken>()), Times.Once);
        service.Verify(x => x.RecordDeliveredAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessDue_AcceptedWithoutProviderIdentity_IsDeadLettered_NotFalselySubmitted()
    {
        var row = new MessageDelivery
        {
            Id = 10, Channel = MessageDeliveryChannel.Email, BodySnapshot = "plain", HtmlBodySnapshot = "<p>plain</p>",
            SubjectSnapshot = "subject", ProtectedDestination = "p:tenant@example.test", AttemptCount = 1,
            IdempotencyKey = "stable-email-token"
        };
        var service = new Mock<IMessageDeliveryService>();
        service.Setup(x => x.LeaseDueAsync(25, It.IsAny<Guid>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([row]);
        service.Setup(x => x.RecordFailedAsync(10, "provider_identity_missing", null, false, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(row);
        service.Setup(x => x.RecordSubmissionStartedAsync(10, It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(row);
        var email = new Mock<IEmailService>();
        email.Setup(x => x.SubmitEmailAsync("tenant@example.test", "subject", "<p>plain</p>", "plain", null,
                It.IsAny<CancellationToken>(), "stable-email-token"))
            .ReturnsAsync(new EmailSubmissionResult(true, "legacy-email", null));
        var processor = new MessageDeliveryProcessor(service.Object, new Protector(), Mock.Of<ISmsService>(),
            Mock.Of<IOutboundSmsSecurityService>(),
            email.Object, Mock.Of<ILogger<MessageDeliveryProcessor>>());

        await processor.ProcessDueAsync();

        service.Verify(x => x.RecordFailedAsync(10, "provider_identity_missing", null, false, null,
            It.IsAny<CancellationToken>()), Times.Once);
        service.Verify(x => x.RecordSubmittedAsync(It.IsAny<long>(), It.IsAny<Guid?>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private sealed class Protector : ICommunicationDestinationProtector
    {
        public string Protect(string destination) => "p:" + destination;
        public string Unprotect(string protectedDestination) => protectedDestination[2..];
    }
}
