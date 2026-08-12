using System.Net;
using System.Text;
using brownstone_hub_api.Services.GoogleAuthService;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Auth;

public class GoogleAuthServiceTests
{
    [Fact]
    public async Task VerifyGoogleAccessTokenAsync_MapsVerifiedEmailFromGoogleUserInfo()
    {
        const string responseJson = """
            {
              "id": "google-user-123",
              "email": "landlord@example.com",
              "verified_email": true,
              "given_name": "Test",
              "family_name": "Landlord",
              "picture": "https://example.com/avatar.png"
            }
            """;
        using var client = new HttpClient(new StaticJsonHandler(responseJson));
        var service = CreateService(client);

        var result = await service.VerifyGoogleAccessTokenAsync("access-token");

        result.Should().NotBeNull();
        result!.Email.Should().Be("landlord@example.com");
        result.EmailVerified.Should().BeTrue();
        result.FirstName.Should().Be("Test");
        result.LastName.Should().Be("Landlord");
    }

    [Fact]
    public async Task VerifyGoogleTokenAsync_MapsVerifiedEmailAndAudienceFromGoogleTokenInfo()
    {
        const string responseJson = """
            {
              "sub": "google-user-123",
              "email": "landlord@example.com",
              "email_verified": "true",
              "given_name": "Test",
              "family_name": "Landlord",
              "aud": "property-peace-client"
            }
            """;
        using var client = new HttpClient(new StaticJsonHandler(responseJson));
        var service = CreateService(client, "property-peace-client");

        var result = await service.VerifyGoogleTokenAsync("id-token");

        result.Should().NotBeNull();
        result!.EmailVerified.Should().BeTrue();
        result.FirstName.Should().Be("Test");
        result.LastName.Should().Be("Landlord");
    }

    private static GoogleAuthService CreateService(HttpClient client, string? clientId = null)
    {
        var values = new Dictionary<string, string?>();
        if (clientId != null)
        {
            values["GoogleOAuth:ClientId"] = clientId;
        }

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

        return new GoogleAuthService(client, configuration, NullLogger<GoogleAuthService>.Instance);
    }

    private sealed class StaticJsonHandler(string json) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
    }
}
