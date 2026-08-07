using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Services.AppleAuthService;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Auth;

public class AppleAuthServiceTests
{
    [Fact]
    public async Task VerifyIdentityTokenAsync_ReturnsUser_ForValidAppleTokenAndNonce()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        const string nonce = "nonce-123";
        var token = CreateToken(rsa, keyId, audience, nonce);
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, nonce);

        result.Should().NotBeNull();
        result!.Subject.Should().Be("apple-user-123");
        result.Email.Should().Be("owner@privaterelay.appleid.com");
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsToken_WhenNonceDoesNotMatch()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(rsa, keyId, audience, "expected-nonce");
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, "different-nonce");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsBlankNonce()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(rsa, keyId, audience, "nonce-123");
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, " ");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsWrongAudience()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        var token = CreateToken(rsa, keyId, "com.example.other", "nonce-123");
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, "com.propertypeace.mobile");

        var result = await service.VerifyIdentityTokenAsync(token, "nonce-123");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsWrongIssuer()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(rsa, keyId, audience, "nonce-123", issuer: "https://attacker.example");
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, "nonce-123");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsExpiredToken()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(rsa, keyId, audience, "nonce-123", expires: DateTime.UtcNow.AddMinutes(-1));
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, "nonce-123");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsUnverifiedEmail()
    {
        using var rsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(rsa, keyId, audience, "nonce-123", emailVerified: false);
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(rsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, "nonce-123");

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyIdentityTokenAsync_RejectsTokenSignedByUnknownKey()
    {
        using var trustedRsa = RSA.Create(2048);
        using var attackerRsa = RSA.Create(2048);
        const string keyId = "apple-test-key";
        const string audience = "com.propertypeace.mobile";
        var token = CreateToken(attackerRsa, keyId, audience, "nonce-123");
        using var client = new HttpClient(new StaticJsonHandler(CreateJwks(trustedRsa, keyId)));
        var service = CreateService(client, audience);

        var result = await service.VerifyIdentityTokenAsync(token, "nonce-123");

        result.Should().BeNull();
    }

    private static AppleAuthService CreateService(HttpClient client, string audience)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AppleOAuth:ClientId"] = audience })
            .Build();
        return new AppleAuthService(client, configuration, NullLogger<AppleAuthService>.Instance);
    }

    private static string CreateToken(
        RSA rsa,
        string keyId,
        string audience,
        string nonce,
        string issuer = "https://appleid.apple.com",
        bool emailVerified = true,
        DateTime? expires = null)
    {
        var key = new RsaSecurityKey(rsa) { KeyId = keyId };
        var credentials = new SigningCredentials(key, SecurityAlgorithms.RsaSha256);
        var expiresAt = expires ?? DateTime.UtcNow.AddMinutes(5);
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims:
            [
                new Claim("sub", "apple-user-123"),
                new Claim("email", "owner@privaterelay.appleid.com"),
                new Claim("email_verified", emailVerified ? "true" : "false"),
                new Claim("nonce", nonce)
            ],
            notBefore: expiresAt > DateTime.UtcNow ? DateTime.UtcNow.AddMinutes(-1) : expiresAt.AddMinutes(-5),
            expires: expiresAt,
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string CreateJwks(RSA rsa, string keyId)
    {
        var parameters = rsa.ExportParameters(false);
        return JsonSerializer.Serialize(new
        {
            keys = new[]
            {
                new
                {
                    kty = "RSA",
                    kid = keyId,
                    use = "sig",
                    alg = "RS256",
                    n = Base64UrlEncoder.Encode(parameters.Modulus),
                    e = Base64UrlEncoder.Encode(parameters.Exponent)
                }
            }
        });
    }

    private sealed class StaticJsonHandler(string json) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
    }
}
