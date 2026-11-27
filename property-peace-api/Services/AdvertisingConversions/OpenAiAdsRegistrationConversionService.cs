using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.AdvertisingConversions;

public sealed class OpenAiAdsRegistrationConversionService(
    DataContext db,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<OpenAiAdsRegistrationConversionService> logger,
    TimeProvider timeProvider) : IRegistrationConversionReporter
{
    private const string SourceUrl = "https://app.propertypeace.io/register";
    private static readonly TimeSpan EligibilityWindow = TimeSpan.FromDays(1);

    public async Task<RegistrationConversionReportResult> ReportCompletedRegistrationAsync(
        long userId,
        string? oppref,
        CancellationToken cancellationToken = default)
    {
        if (!IsValidClickReference(oppref))
            return RegistrationConversionReportResult.InvalidClickReference;

        var pixelId = configuration["OpenAiAds:PixelId"];
        var conversionsApiKey = configuration["OpenAiAds:ConversionsApiKey"];
        if (string.IsNullOrWhiteSpace(pixelId) || string.IsNullOrWhiteSpace(conversionsApiKey))
            return RegistrationConversionReportResult.NotConfigured;

        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null || user.IsDeleted || user.IsSuspended || user.IsDemo || user.IsSeeded || user.CurrentOrganizationId is not long organizationId)
            return RegistrationConversionReportResult.NotEligible;

        var organization = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(candidate =>
            candidate.Id == organizationId && candidate.OwnerId == userId && candidate.IsActive && !candidate.IsDeleted,
            cancellationToken);
        if (organization is null)
            return RegistrationConversionReportResult.NotEligible;

        var now = timeProvider.GetUtcNow();
        var userCreatedAt = AsUtc(user.CreateDate);
        var organizationCreatedAt = AsUtc(organization.CreatedAt);
        if (!IsRecent(userCreatedAt, now) || !IsRecent(organizationCreatedAt, now))
            return RegistrationConversionReportResult.NotEligible;

        var completionTime = userCreatedAt > organizationCreatedAt ? userCreatedAt : organizationCreatedAt;
        var eventIdentity = FormattableString.Invariant($"property-peace:registration:{userId}:{userCreatedAt.Ticks}");
        var eventId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(eventIdentity)));
        var payload = JsonSerializer.Serialize(new
        {
            events = new[]
            {
                new
                {
                    id = $"pp-registration-{eventId}",
                    type = "registration_completed",
                    timestamp_ms = completionTime.ToUnixTimeMilliseconds(),
                    oppref,
                    source_url = SourceUrl,
                    action_source = "web",
                    data = new { type = "customer_action" }
                }
            }
        });

        var client = httpClientFactory.CreateClient("OpenAiAdsConversions");
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post,
                    $"https://bzr.openai.com/v1/events?pid={Uri.EscapeDataString(pixelId)}")
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json")
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", conversionsApiKey);

                using var response = await client.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                    return RegistrationConversionReportResult.Sent;
                if (!IsTransient(response.StatusCode))
                {
                    logger.LogWarning("OpenAI Ads registration conversion was rejected with status {StatusCode}.", (int)response.StatusCode);
                    return RegistrationConversionReportResult.DeliveryFailed;
                }
            }
            catch (Exception exception) when (exception is HttpRequestException ||
                exception is OperationCanceledException && !cancellationToken.IsCancellationRequested)
            {
                if (attempt == 1)
                {
                    logger.LogWarning("OpenAI Ads registration conversion delivery failed ({FailureType}).", exception.GetType().Name);
                    return RegistrationConversionReportResult.DeliveryFailed;
                }
            }
        }

        logger.LogWarning("OpenAI Ads registration conversion delivery failed after a transient response.");
        return RegistrationConversionReportResult.DeliveryFailed;
    }

    private static bool IsValidClickReference(string? clickReference) =>
        !string.IsNullOrWhiteSpace(clickReference) &&
        clickReference.Length <= 2048 &&
        !clickReference.Any(character => char.IsControl(character) || char.IsWhiteSpace(character));

    private static bool IsTransient(HttpStatusCode statusCode) =>
        statusCode == HttpStatusCode.TooManyRequests || (int)statusCode >= 500;

    private static bool IsRecent(DateTimeOffset timestamp, DateTimeOffset now) =>
        timestamp <= now && now - timestamp <= EligibilityWindow;

    private static DateTimeOffset AsUtc(DateTime timestamp) =>
        timestamp.Kind == DateTimeKind.Local
            ? new DateTimeOffset(timestamp.ToUniversalTime())
            : new DateTimeOffset(DateTime.SpecifyKind(timestamp, DateTimeKind.Utc));
}
