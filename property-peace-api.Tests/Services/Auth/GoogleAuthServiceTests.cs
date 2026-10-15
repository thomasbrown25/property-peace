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

    [Theory]
    [InlineData("web-client", true)]
    [InlineData("422382677454-1ttb399tb2vucfo109s3ijvi8bvsahgt.apps.googleusercontent.com", true)]
    [InlineData("other-client", false)]
    [InlineData(null, false)]
    [InlineData("", false)]
    public async Task VerifyGoogleTokenAsync_AllowsOnlyConfiguredWebAndIosAudiences(string? audience, bool allowed)
    {
        var responseJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            sub = "google-user-123",
            email = "landlord@example.com",
            email_verified = "true",
            aud = audience
        });
        using var client = new HttpClient(new StaticJsonHandler(responseJson));
        var service = CreateService(client, "web-client",
            "422382677454-1ttb399tb2vucfo109s3ijvi8bvsahgt.apps.googleusercontent.com");

        var result = await service.VerifyGoogleTokenAsync("id-token");

        if (allowed)
            result.Should().NotBeNull();
        else
            result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyGoogleTokenAsync_RejectsOmittedAudience()
    {
        using var client = new HttpClient(new StaticJsonHandler("""
            {"sub":"google-user-123","email":"landlord@example.com"}
            """));

        (await CreateService(client, "web-client", "ios-client").VerifyGoogleTokenAsync("id-token"))
            .Should().BeNull();
    }

    [Fact]
    public async Task VerifyGoogleTokenAsync_RejectsAudienceWhenNoClientsConfigured()
    {
        using var client = new HttpClient(new StaticJsonHandler("""
            {"sub":"google-user-123","aud":"web-client"}
            """));

        (await CreateService(client).VerifyGoogleTokenAsync("id-token")).Should().BeNull();
    }

    private static GoogleAuthService CreateService(HttpClient client, string? clientId = null, string? iosClientId = null)
    {
        var values = new Dictionary<string, string?>();
        if (clientId != null)
        {
            values["GoogleOAuth:ClientId"] = clientId;
        }
        if (iosClientId != null)
        {
            values["GoogleOAuth:IosClientId"] = iosClientId;
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
