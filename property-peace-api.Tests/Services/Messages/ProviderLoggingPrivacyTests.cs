using brownstone_hub_api.Config;
using brownstone_hub_api.Services;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.SmsService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Messages;

public sealed class ProviderLoggingPrivacyTests
{
    [Theory]
    [InlineData("person.private@example.test", "p***@example.test")]
    [InlineData("Display Name <person.private@example.test>", "p***@example.test")]
    [InlineData("+1 (555) 123-4567", "***4567")]
    [InlineData("opaque-destination", "[redacted]")]
    public void MaskDestination_DoesNotReturnRawDestination(string raw, string expected)
    {
        CommunicationLogSanitizer.MaskDestination(raw).Should().Be(expected);
    }

    [Fact]
    public void AzureEmail_ConfigurationLogMasksSenderAddress()
    {
        const string sender = "sender.private@example.test";
        var logger = new CapturingLogger<AzureCommunicationEmailService>();

        _ = new AzureCommunicationEmailService(Options.Create(new AzureCommunicationSettings
        {
            SenderAddress = sender
        }), logger);

        logger.Text.Should().NotContain(sender);
        logger.Text.Should().Contain("s***@example.test");
    }

    [Fact]
    public async Task AzureSms_InvalidDestinationLogsNoRawCommunicationData()
    {
        const string destination = "recipient-private";
        const string sender = "+15550001111";
        const string content = "private message content";
        var logger = new CapturingLogger<AzureCommunicationSmsService>();
        var service = new AzureCommunicationSmsService(Options.Create(new AzureCommunicationSettings
        {
            ConnectionString = "endpoint=https://example.test/;accesskey=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            SmsFromPhoneNumber = sender
        }), logger);

        var result = await service.SubmitSmsAsync(destination, content);

        result.Accepted.Should().BeFalse();
        logger.Text.Should().NotContain(destination).And.NotContain(sender).And.NotContain(content);
        logger.Text.Should().Contain("[redacted]");
    }

    [Fact]
    public async Task TwilioSms_InvalidDestinationLogsNoRawCommunicationData()
    {
        const string destination = "recipient-private";
        const string sender = "+15550001111";
        const string content = "private message content";
        var logger = new CapturingLogger<TwilioSmsService>();
        var service = new TwilioSmsService(Options.Create(new TwilioSettings
        {
            AccountSid = "AC00000000000000000000000000000000",
            AuthToken = "test-token",
            FromPhoneNumber = sender
        }), logger);

        var result = await service.SubmitSmsAsync(destination, content);

        result.Accepted.Should().BeFalse();
        logger.Text.Should().NotContain(destination).And.NotContain(sender).And.NotContain(content);
        logger.Text.Should().Contain("[redacted]");
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        private readonly List<string> _entries = [];
        public string Text => string.Join("\n", _entries);

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => _entries.Add(formatter(state, exception));
    }
}
