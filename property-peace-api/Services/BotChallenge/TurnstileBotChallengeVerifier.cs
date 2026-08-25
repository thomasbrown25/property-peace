using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.BotChallenge;

public sealed class TurnstileBotChallengeVerifier(
    HttpClient httpClient,
    IOptions<TurnstileOptions> options,
    ILogger<TurnstileBotChallengeVerifier> logger) : IBotChallengeVerifier
{
    private readonly TurnstileOptions _options = options.Value;

    public async Task<BotChallengeResult> VerifyAsync(
        string? token,
        string? remoteIp,
        string expectedAction,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
            return BotChallengeResult.Passed();

        var allowedHostnames = _options.AllowedHostnames?
            .Where(hostname => !string.IsNullOrWhiteSpace(hostname))
            .Select(hostname => hostname.Trim().TrimEnd('.'))
            .Where(hostname => hostname.Length > 0)
            .ToArray() ?? [];

        if (string.IsNullOrWhiteSpace(_options.SecretKey) ||
            allowedHostnames.Length == 0 ||
            !Uri.TryCreate(_options.SiteVerifyUrl, UriKind.Absolute, out var siteVerifyUri) ||
            siteVerifyUri.Scheme != Uri.UriSchemeHttps)
        {
            logger.LogError("Turnstile is enabled with invalid server configuration.");
            return BotChallengeResult.Failed("server-misconfigured");
        }

        if (string.IsNullOrWhiteSpace(token))
            return BotChallengeResult.Failed("missing-input-response");

        try
        {
            var fields = new Dictionary<string, string>
            {
                ["secret"] = _options.SecretKey,
                ["response"] = token
            };
            if (!string.IsNullOrWhiteSpace(remoteIp))
                fields["remoteip"] = remoteIp;

            using var request = new HttpRequestMessage(HttpMethod.Post, _options.SiteVerifyUrl)
            {
                Content = new FormUrlEncodedContent(fields)
            };
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Turnstile siteverify returned HTTP {StatusCode}.", (int)response.StatusCode);
                return BotChallengeResult.Failed("provider-unavailable");
            }

            var payload = await response.Content.ReadFromJsonAsync<TurnstileSiteVerifyResponse>(cancellationToken: cancellationToken);
            if (payload is null)
                return BotChallengeResult.Failed("invalid-provider-response");

            if (!payload.Success)
            {
                var providerErrors = payload.ErrorCodes?
                    .Where(code => !string.IsNullOrWhiteSpace(code))
                    .ToArray() ?? [];
                return new BotChallengeResult(false, providerErrors.Length > 0 ? providerErrors : ["challenge-failed"]);
            }

            if (string.IsNullOrWhiteSpace(payload.Action) || string.IsNullOrWhiteSpace(payload.Hostname))
                return BotChallengeResult.Failed("invalid-provider-response");

            if (!string.Equals(payload.Action, expectedAction, StringComparison.Ordinal))
                return BotChallengeResult.Failed("action-mismatch");

            var providerHostname = payload.Hostname.Trim().TrimEnd('.');
            if (!allowedHostnames.Contains(providerHostname, StringComparer.OrdinalIgnoreCase))
                return BotChallengeResult.Failed("hostname-mismatch");

            return BotChallengeResult.Passed();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Turnstile siteverify timed out.");
            return BotChallengeResult.Failed("provider-unavailable");
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Turnstile siteverify request failed.");
            return BotChallengeResult.Failed("provider-unavailable");
        }
        catch (JsonException exception)
        {
            logger.LogWarning(exception, "Turnstile siteverify returned invalid JSON.");
            return BotChallengeResult.Failed("invalid-provider-response");
        }
    }

    private sealed class TurnstileSiteVerifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; init; }

        [JsonPropertyName("hostname")]
        public string Hostname { get; init; } = string.Empty;

        [JsonPropertyName("action")]
        public string Action { get; init; } = string.Empty;

        [JsonPropertyName("error-codes")]
        public string[] ErrorCodes { get; init; } = [];
    }
}
