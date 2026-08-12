using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

namespace brownstone_hub_api.Services.AppleAuthService;

public sealed class AppleAuthService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<AppleAuthService> logger) : IAppleAuthService
{
    private const string AppleIssuer = "https://appleid.apple.com";
    private const string AppleKeysUrl = "https://appleid.apple.com/auth/keys";

    public async Task<AppleUserInfo?> VerifyIdentityTokenAsync(
        string identityToken,
        string nonce,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(identityToken) || string.IsNullOrWhiteSpace(nonce))
        {
            return null;
        }

        var clientId = configuration["AppleOAuth:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
        {
            logger.LogError("AppleOAuth:ClientId is not configured");
            return null;
        }

        try
        {
            var jwksJson = await httpClient.GetStringAsync(AppleKeysUrl, cancellationToken);
            var signingKeys = new JsonWebKeySet(jwksJson).GetSigningKeys();
            var validation = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = AppleIssuer,
                ValidateAudience = true,
                ValidAudience = clientId,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = signingKeys,
                RequireSignedTokens = true,
                RequireExpirationTime = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256]
            };

            var tokenHandler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = tokenHandler.ValidateToken(identityToken, validation, out _);
            var subject = principal.FindFirst("sub")?.Value;
            var email = principal.FindFirst("email")?.Value;
            var emailVerified = principal.FindFirst("email_verified")?.Value;
            var tokenNonce = principal.FindFirst("nonce")?.Value;

            if (string.IsNullOrWhiteSpace(subject) ||
                string.IsNullOrWhiteSpace(email) ||
                !string.Equals(emailVerified, "true", StringComparison.OrdinalIgnoreCase) ||
                !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(tokenNonce ?? string.Empty),
                    System.Text.Encoding.UTF8.GetBytes(nonce)))
            {
                logger.LogWarning("Apple identity token failed required claim validation");
                return null;
            }

            return new AppleUserInfo(subject, email);
        }
        catch (Exception exception) when (exception is SecurityTokenException or HttpRequestException or FormatException)
        {
            logger.LogWarning(exception, "Apple identity token validation failed");
            return null;
        }
    }
}
