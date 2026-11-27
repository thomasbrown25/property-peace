using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;

namespace brownstone_hub_api.Services.StripeRentPayments;

public sealed class StripeConnectOAuth(IConfiguration configuration, IDataProtectionProvider dataProtection, IHttpClientFactory httpClients)
{
    public const string HttpClientName = "StripeConnectOAuth";
    private const string AuthorizeEndpoint = "https://connect.stripe.com/oauth/authorize";
    private const string TokenEndpoint = "https://connect.stripe.com/oauth/token";
    private readonly ITimeLimitedDataProtector _stateProtector = dataProtection
        .CreateProtector("PropertyPeace.StripeConnectOAuth.State.v1").ToTimeLimitedDataProtector();

    public bool IsConfigured => GetSettings() is not null;

    public string? CreateAuthorizationUrl(long userId, long organizationId)
    {
        var settings = GetSettings();
        if (settings is null) return null;
        var state = new AuthorizationState(userId, organizationId, Guid.NewGuid().ToString("N"), settings.ClientId, settings.LiveMode);
        return QueryHelpers.AddQueryString(AuthorizeEndpoint, new Dictionary<string, string?>
        {
            ["client_id"] = settings.ClientId,
            ["response_type"] = "code",
            ["scope"] = "read_write",
            ["redirect_uri"] = settings.RedirectUri,
            ["state"] = _stateProtector.Protect(JsonSerializer.Serialize(state), TimeSpan.FromMinutes(20))
        });
    }

    public string? ValidateState(string? protectedState, long userId, long organizationId)
    {
        var settings = GetSettings();
        if (settings is null || string.IsNullOrEmpty(protectedState) || protectedState.Length > 2048) return null;
        try
        {
            var state = JsonSerializer.Deserialize<AuthorizationState>(_stateProtector.Unprotect(protectedState));
            return state != null && state.UserId == userId && state.OrganizationId == organizationId &&
                state.ClientId == settings.ClientId && state.LiveMode == settings.LiveMode ? state.Nonce : null;
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
        {
            return null;
        }
    }

    public async Task<string?> ExchangeCodeAsync(string code, CancellationToken cancellationToken)
    {
        var settings = GetSettings();
        if (settings is null) return null;
        using var client = httpClients.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, TokenEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.ASCII.GetBytes(settings.SecretKey + ":")));
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code
        });

        // Stripe can revoke the connection if an authorization code is exchanged twice.
        // The caller consumes the code durably before this single, non-retried request.
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;
        var result = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken);
        return result?.Scope == "read_write" && result.LiveMode == settings.LiveMode &&
            result.AccountId is { Length: > 5 and <= 255 } accountId &&
            accountId.StartsWith("acct_", StringComparison.Ordinal) &&
            accountId.Skip(5).All(char.IsAsciiLetterOrDigit)
            ? accountId : null;
    }

    private Settings? GetSettings()
    {
        var clientId = configuration["Stripe:ConnectOAuthClientId"]?.Trim();
        var secret = configuration["Stripe:SecretKey"]?.Trim();
        var liveMode = secret?.StartsWith("sk_live_", StringComparison.Ordinal) == true;
        if (clientId is not { Length: > 3 } || !clientId.StartsWith("ca_", StringComparison.Ordinal) ||
            !clientId.Skip(3).All(char.IsAsciiLetterOrDigit) ||
            secret == null || (!liveMode && !secret.StartsWith("sk_test_", StringComparison.Ordinal)) ||
            secret.Contains("placeholder", StringComparison.OrdinalIgnoreCase) ||
            secret.Contains("your_", StringComparison.OrdinalIgnoreCase) ||
            secret.Contains("redacted", StringComparison.OrdinalIgnoreCase) ||
            !Uri.TryCreate(configuration["FrontendBaseUrl"]?.Trim(), UriKind.Absolute, out var frontEnd) ||
            !(frontEnd.Scheme == Uri.UriSchemeHttps || (!liveMode && frontEnd.IsLoopback && frontEnd.Scheme == Uri.UriSchemeHttp)) ||
            frontEnd.UserInfo.Length > 0 || frontEnd.Query.Length > 0 || frontEnd.Fragment.Length > 0) return null;

        var redirectUri = $"{frontEnd.AbsoluteUri.TrimEnd('/')}/landlord/settings?tab=payments&paymentTab=stripe&stripe=existing-return";
        return new Settings(clientId, secret, liveMode, redirectUri);
    }

    private sealed record AuthorizationState(long UserId, long OrganizationId, string Nonce, string ClientId, bool LiveMode);
    private sealed record Settings(string ClientId, string SecretKey, bool LiveMode, string RedirectUri);
    private sealed record TokenResponse(
        [property: JsonPropertyName("stripe_user_id")] string? AccountId,
        [property: JsonPropertyName("scope")] string? Scope,
        [property: JsonPropertyName("livemode")] bool? LiveMode);
}
