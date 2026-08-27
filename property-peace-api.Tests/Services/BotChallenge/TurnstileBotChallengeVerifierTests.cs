using System.Net;
using System.Text;
using brownstone_hub_api.Services.BotChallenge;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace brownstone_hub_api.Tests.Services.BotChallenge;

public sealed class TurnstileBotChallengeVerifierTests
{
    [Fact]
    public async Task VerifyAsync_BypassesProvider_WhenProtectionIsDisabled()
    {
        var handler = NeverCalledHandler();
        var verifier = CreateVerifier(handler, new TurnstileOptions { Enabled = false });

        var result = await verifier.VerifyAsync(null, "203.0.113.10", "public-signup-email");

        result.Success.Should().BeTrue();
        handler.RequestCount.Should().Be(0);
    }

    [Fact]
    public async Task VerifyAsync_FailsClosed_WhenEnabledWithoutSecret()
    {
        var handler = NeverCalledHandler();
        var options = EnabledOptions();
        options.SecretKey = string.Empty;
        var verifier = CreateVerifier(handler, options);

        var result = await verifier.VerifyAsync("challenge-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("server-misconfigured");
        handler.RequestCount.Should().Be(0);
    }

    [Fact]
    public async Task VerifyAsync_FailsClosed_WhenEnabledWithoutAllowedHostname()
    {
        var handler = NeverCalledHandler();
        var options = EnabledOptions();
        options.AllowedHostnames = [];
        var verifier = CreateVerifier(handler, options);

        var result = await verifier.VerifyAsync("challenge-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("server-misconfigured");
        handler.RequestCount.Should().Be(0);
    }

    [Theory]
    [InlineData(" ", "https://challenges.cloudflare.com/turnstile/v0/siteverify")]
    [InlineData("app.propertypeace.io", "http://challenges.cloudflare.com/turnstile/v0/siteverify")]
    [InlineData("app.propertypeace.io", "not-a-url")]
    public async Task VerifyAsync_FailsClosed_WhenServerConfigurationIsInvalid(string allowedHostname, string siteVerifyUrl)
    {
        var handler = NeverCalledHandler();
        var options = EnabledOptions();
        options.AllowedHostnames = [allowedHostname];
        options.SiteVerifyUrl = siteVerifyUrl;
        var verifier = CreateVerifier(handler, options);

        var result = await verifier.VerifyAsync("challenge-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("server-misconfigured");
        handler.RequestCount.Should().Be(0);
    }

    [Fact]
    public async Task VerifyAsync_RejectsMissingToken_WhenProtectionIsEnabled()
    {
        var handler = NeverCalledHandler();
        var verifier = CreateVerifier(handler, EnabledOptions());

        var result = await verifier.VerifyAsync(" ", "203.0.113.10", "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("missing-input-response");
        handler.RequestCount.Should().Be(0);
    }

    [Fact]
    public async Task VerifyAsync_PostsTokenAndAcceptsMatchingActionAndHostname()
    {
        var handler = JsonHandler("""{"success":true,"hostname":"app.propertypeace.io","action":"public-signup-email","error-codes":[]}""");
        var verifier = CreateVerifier(handler, EnabledOptions());

        var result = await verifier.VerifyAsync("challenge-token", "203.0.113.10", "public-signup-email");

        result.Success.Should().BeTrue();
        handler.RequestCount.Should().Be(1);
        handler.LastBody.Should().Contain("secret=test-secret");
        handler.LastBody.Should().Contain("response=challenge-token");
        handler.LastBody.Should().Contain("remoteip=203.0.113.10");
    }

    [Theory]
    [InlineData("other-action", "app.propertypeace.io", "action-mismatch")]
    [InlineData("public-signup-email", "evil.example", "hostname-mismatch")]
    public async Task VerifyAsync_RejectsMismatchedProviderContext(string action, string hostname, string expectedError)
    {
        var handler = JsonHandler($"{{\"success\":true,\"hostname\":\"{hostname}\",\"action\":\"{action}\"}}");
        var verifier = CreateVerifier(handler, EnabledOptions());

        var result = await verifier.VerifyAsync("challenge-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain(expectedError);
    }

    [Fact]
    public async Task VerifyAsync_RejectsProviderOutage()
    {
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var verifier = CreateVerifier(handler, EnabledOptions());

        var result = await verifier.VerifyAsync("challenge-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("provider-unavailable");
    }

    [Fact]
    public async Task VerifyAsync_PreservesProviderRejectionCodes()
    {
        var handler = JsonHandler("""{"success":false,"error-codes":["timeout-or-duplicate"]}""");
        var verifier = CreateVerifier(handler, EnabledOptions());

        var result = await verifier.VerifyAsync("used-token", null, "public-signup-email");

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("timeout-or-duplicate");
    }

    private static TurnstileOptions EnabledOptions() => new()
    {
        Enabled = true,
        SecretKey = "test-secret",
        AllowedHostnames = ["app.propertypeace.io"]
    };

    private static RecordingHandler NeverCalledHandler() =>
        new(_ => throw new InvalidOperationException("HTTP should not be called"));

    private static RecordingHandler JsonHandler(string json) =>
        new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        });

    private static TurnstileBotChallengeVerifier CreateVerifier(RecordingHandler handler, TurnstileOptions options) =>
        new(new HttpClient(handler), Options.Create(options), NullLogger<TurnstileBotChallengeVerifier>.Instance);

    private sealed class RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory) : HttpMessageHandler
    {
        public int RequestCount { get; private set; }
        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return responseFactory(request);
        }
    }
}
