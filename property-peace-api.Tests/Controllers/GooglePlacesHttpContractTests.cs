using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using AspNetCoreRateLimit;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.GooglePlacesService;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class GooglePlacesHttpContractTests
{
    [Fact]
    public async Task Autocomplete_MalformedSessionTokenReturnsSafeServiceResponse()
    {
        var service = new Mock<IGooglePlacesService>();
        await using var server = await RunningApplication.StartControllerAsync(service.Object);

        using var response = await server.Client.PostAsJsonAsync(
            "/api/google-places/autocomplete",
            new { input = "1600 Penn", sessionToken = "not-a-uuid" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        await AssertSafeEnvelopeAsync(response, "Enter a valid address search.");
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Details_MalformedSessionTokenReturnsSafeServiceResponse()
    {
        var service = new Mock<IGooglePlacesService>();
        await using var server = await RunningApplication.StartControllerAsync(service.Object);

        using var response = await server.Client.GetAsync(
            "/api/google-places/details/place-123?sessionToken=not-a-uuid");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        await AssertSafeEnvelopeAsync(response, "Select a valid address suggestion.");
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task PlacesRateLimit_ChangingXRealIpCannotEvadeConnectionLimit()
    {
        await using var server = await RunningApplication.StartRateLimitedAsync();

        HttpResponseMessage? response = null;
        for (var requestNumber = 1; requestNumber <= 61; requestNumber++)
        {
            response?.Dispose();
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/google-places/autocomplete");
            request.Headers.Add("X-Real-IP", $"198.51.100.{requestNumber}");
            response = await server.Client.SendAsync(request);
        }

        using (response)
            response!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    private static async Task AssertSafeEnvelopeAsync(HttpResponseMessage response, string message)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;
        root.GetProperty("success").GetBoolean().Should().BeFalse();
        root.GetProperty("statusCode").GetInt32().Should().Be(400);
        root.GetProperty("message").GetString().Should().Be(message);
        root.TryGetProperty("title", out _).Should().BeFalse(
            "the API contract is ServiceResponse, not framework ValidationProblemDetails");
    }

    private sealed class RunningApplication(WebApplication app, HttpClient client) : IAsyncDisposable
    {
        public HttpClient Client { get; } = client;

        public static async Task<RunningApplication> StartControllerAsync(IGooglePlacesService service)
        {
            var builder = CreateBuilder();
            builder.Services.AddLogging();
            builder.Services.AddSingleton(service);
            builder.Services
                .AddAuthentication(TestAuthenticationHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>(
                    TestAuthenticationHandler.SchemeName,
                    _ => { });
            builder.Services.AddAuthorization();
            builder.Services.AddControllers()
                .AddApplicationPart(typeof(GooglePlacesController).Assembly);

            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            return await StartAsync(app);
        }

        public static async Task<RunningApplication> StartRateLimitedAsync()
        {
            var builder = CreateBuilder();
            builder.Services.AddLogging();
            builder.Services.AddMemoryCache();
            builder.Services.Configure<IpRateLimitOptions>(options =>
            {
                options.EnableEndpointRateLimiting = true;
                options.StackBlockedRequests = false;
                options.HttpStatusCode = 429;
                options.RealIpHeader = "X-Real-IP";
                options.GeneralRules =
                [
                    new RateLimitRule
                    {
                        Endpoint = "POST:/api/google-places/autocomplete",
                        Period = "1m",
                        Limit = 60
                    }
                ];
            });
            builder.Services.AddInMemoryRateLimiting();
            builder.Services.AddSingleton<IRateLimitConfiguration, TrustedConnectionRateLimitConfiguration>();

            var app = builder.Build();
            app.UseIpRateLimiting();
            app.MapPost("/api/google-places/autocomplete", () => Results.Ok());
            return await StartAsync(app);
        }

        private static WebApplicationBuilder CreateBuilder()
        {
            var options = new WebApplicationOptions
            {
                ApplicationName = typeof(GooglePlacesController).Assembly.FullName,
                EnvironmentName = "Testing"
            };
            var builder = WebApplication.CreateBuilder(options);
            builder.WebHost.UseKestrel().UseUrls("http://127.0.0.1:0");
            return builder;
        }

        private static async Task<RunningApplication> StartAsync(WebApplication app)
        {
            await app.StartAsync();
            var address = app.Services
                .GetRequiredService<IServer>()
                .Features
                .Get<IServerAddressesFeature>()!
                .Addresses
                .Single();
            return new RunningApplication(app, new HttpClient { BaseAddress = new Uri(address) });
        }

        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    private sealed class TestAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string SchemeName = "PlacesContractTest";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "places-test"), new Claim(ClaimTypes.Role, "Landlord")],
                SchemeName);
            var principal = new ClaimsPrincipal(identity);
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(principal, SchemeName)));
        }
    }
}