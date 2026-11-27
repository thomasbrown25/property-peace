using System.Net;
using System.Text.Json;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.AdvertisingConversions;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.AdvertisingConversions;

public sealed class OpenAiAdsRegistrationConversionServiceTests : IDisposable
{
    private readonly Data.DataContext _db = DbContextFactory.Create();

    [Fact]
    public async Task ReportCompletedRegistrationAsync_SendsTheSupportedSignupEventForANewOrganizationOwner()
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now);
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = CreateService(handler, now);

        var result = await service.ReportCompletedRegistrationAsync(101, "opaque-reference-value");

        result.Should().Be(RegistrationConversionReportResult.Sent);
        handler.Requests.Should().ContainSingle();
        var request = handler.Requests.Single();
        request.Uri.Should().Be("https://bzr.openai.com/v1/events?pid=pixel-id");
        request.Authorization.Should().Be("Bearer server-key");
        using var document = JsonDocument.Parse(request.Body);
        var eventPayload = document.RootElement.GetProperty("events")[0];
        eventPayload.GetProperty("type").GetString().Should().Be("registration_completed");
        eventPayload.GetProperty("oppref").GetString().Should().Be("opaque-reference-value");
        eventPayload.GetProperty("action_source").GetString().Should().Be("web");
        eventPayload.GetProperty("source_url").GetString().Should().Be("https://app.propertypeace.io/register");
        eventPayload.GetProperty("data").GetProperty("type").GetString().Should().Be("customer_action");
        eventPayload.GetProperty("id").GetString().Should().MatchRegex("^pp-registration-[A-F0-9]{64}$");
        eventPayload.TryGetProperty("user", out _).Should().BeFalse();
    }

    [Fact]
    public async Task ReportCompletedRegistrationAsync_DoesNotSendForAnOlderOrganizationOwner()
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now.AddDays(-2));
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = CreateService(handler, now);

        var result = await service.ReportCompletedRegistrationAsync(101, "opaque-reference-value");

        result.Should().Be(RegistrationConversionReportResult.NotEligible);
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task ReportCompletedRegistrationAsync_DoesNotCountANewOrganizationForAnExistingAccount()
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now);
        var user = await _db.Users.FindAsync(101L);
        user!.CreateDate = now.AddDays(-30).UtcDateTime;
        await _db.SaveChangesAsync();
        var handler = new RecordingHandler(HttpStatusCode.OK);

        var result = await CreateService(handler, now).ReportCompletedRegistrationAsync(101, "opaque-reference-value");

        result.Should().Be(RegistrationConversionReportResult.NotEligible);
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task ReportCompletedRegistrationAsync_RetriesTransientFailureWithTheSameEvent()
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now);
        var handler = new RecordingHandler(HttpStatusCode.BadGateway, HttpStatusCode.Accepted);
        var service = CreateService(handler, now);

        var result = await service.ReportCompletedRegistrationAsync(101, "opaque-reference-value");

        result.Should().Be(RegistrationConversionReportResult.Sent);
        handler.Requests.Should().HaveCount(2);
        handler.Requests.Select(request => request.Body).Distinct().Should().ContainSingle();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("internal space")]
    [InlineData("contains\nnewline")]
    public async Task ReportCompletedRegistrationAsync_RejectsInvalidClickReferences(string oppref)
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now);
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = CreateService(handler, now);

        var result = await service.ReportCompletedRegistrationAsync(101, oppref);

        result.Should().Be(RegistrationConversionReportResult.InvalidClickReference);
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task ReportCompletedRegistrationAsync_DoesNothingUntilTheServerCredentialsAreConfigured()
    {
        var now = new DateTimeOffset(2026, 11, 27, 15, 0, 0, TimeSpan.Zero);
        await SeedEligibleSignupAsync(now);
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var service = CreateService(handler, now, configured: false);

        var result = await service.ReportCompletedRegistrationAsync(101, "opaque-reference-value");

        result.Should().Be(RegistrationConversionReportResult.NotConfigured);
        handler.Requests.Should().BeEmpty();
    }

    private async Task SeedEligibleSignupAsync(DateTimeOffset createdAt)
    {
        _db.Users.Add(new User
        {
            Id = 101,
            Email = "new-owner@example.com",
            CreateDate = createdAt.UtcDateTime,
            CurrentOrganizationId = 501
        });
        _db.Organizations.Add(new Organization
        {
            Id = 501,
            OwnerId = 101,
            Name = "New owner organization",
            CreatedAt = createdAt.UtcDateTime,
            IsActive = true
        });
        await _db.SaveChangesAsync();
    }

    private OpenAiAdsRegistrationConversionService CreateService(RecordingHandler handler, DateTimeOffset now, bool configured = true)
    {
        var settings = configured
            ? new Dictionary<string, string?> { ["OpenAiAds:PixelId"] = "pixel-id", ["OpenAiAds:ConversionsApiKey"] = "server-key" }
            : [];
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new OpenAiAdsRegistrationConversionService(
            _db,
            new StaticHttpClientFactory(new HttpClient(handler)),
            configuration,
            NullLogger<OpenAiAdsRegistrationConversionService>.Instance,
            new FixedTimeProvider(now));
    }

    public void Dispose() => _db.Dispose();

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class StaticHttpClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private sealed class RecordingHandler(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        private readonly Queue<HttpStatusCode> _statuses = new(statuses);
        public List<(string Uri, string Authorization, string Body)> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add((request.RequestUri!.ToString(), request.Headers.Authorization!.ToString(), await request.Content!.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(_statuses.Dequeue());
        }
    }
}
