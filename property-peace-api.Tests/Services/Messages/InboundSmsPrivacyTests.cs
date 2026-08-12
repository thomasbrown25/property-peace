using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Messages;

public sealed class InboundSmsPrivacyTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    [Fact]
    public async Task UnknownDestination_LogDoesNotContainRawPhoneNumbers()
    {
        const string from = "+15551230001";
        const string to = "+15559870002";
        var logger = new CapturingLogger<InboundSmsService>();
        var service = new InboundSmsService(
            Mock.Of<INotificationSettingRepository>(), Mock.Of<IConversationRepository>(),
            Mock.Of<IMessageRepository>(), Mock.Of<IUserRepository>(),
            Mock.Of<IOrganizationSmsNumberRepository>(), _context,
            Mock.Of<INotificationService>(), Mock.Of<IHubContext<ConversationHub>>(), logger);

        await service.HandleInboundAsync(from, to, "hello", "SM123");

        logger.Messages.Should().NotContain(x => x.Contains(from, StringComparison.Ordinal));
        logger.Messages.Should().NotContain(x => x.Contains(to, StringComparison.Ordinal));
    }

    [Fact]
    public async Task AuthenticatedWebhook_LogDoesNotContainRawPhoneNumbers()
    {
        const string token = "twilio-test-token";
        const string from = "+15551230001";
        const string to = "+15559870002";
        const string path = "/api/webhook/twilio/inbound-sms";
        var values = new Dictionary<string, StringValues>
        {
            ["From"] = from, ["To"] = to, ["Body"] = "hello", ["MessageSid"] = "SM123"
        };
        var signatureSource = $"http://localhost{path}" + string.Concat(values.OrderBy(x => x.Key)
            .Select(x => x.Key + x.Value.ToString()));
        var signature = Convert.ToBase64String(HMACSHA1.HashData(
            Encoding.UTF8.GetBytes(token), Encoding.UTF8.GetBytes(signatureSource)));
        var context = new DefaultHttpContext();
        context.Request.Scheme = "http";
        context.Request.Host = new HostString("localhost");
        context.Request.Path = path;
        context.Request.Headers["X-Twilio-Signature"] = signature;
        context.Features.Set<IFormFeature>(new FormFeature(new FormCollection(values)));
        var inbound = new Mock<IInboundSmsService>();
        inbound.Setup(x => x.HandleInboundAsync(from, to, "hello", "SM123")).ReturnsAsync("<Response />");
        var logger = new CapturingLogger<TwilioWebhookController>();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Twilio:AuthToken"] = token
        }).Build();
        var controller = new TwilioWebhookController(inbound.Object, Mock.Of<IOrganizationSmsNumberRepository>(),
            Mock.Of<IMessageDeliveryService>(), configuration, logger)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        var result = await controller.InboundSms();

        result.Should().BeOfType<ContentResult>();
        logger.Messages.Should().NotContain(x => x.Contains(from, StringComparison.Ordinal));
        logger.Messages.Should().NotContain(x => x.Contains(to, StringComparison.Ordinal));
    }

    public void Dispose() => _context.Dispose();

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
