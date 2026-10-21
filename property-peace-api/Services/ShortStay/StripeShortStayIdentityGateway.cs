using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Stripe;
using Stripe.Identity;

namespace brownstone_hub_api.Services.ShortStay;

// Hosted Stripe Identity is a provider workflow, not a legal certification of identity.
// Never expose the Stripe VerificationSession or VerificationReport to callers.
public sealed record ShortStayIdentitySession(string SessionId, string? HostedUrl, string Status);

public interface IStripeShortStayIdentityGateway
{
    Task<ShortStayIdentitySession> CreateAsync(
        string applicationId, string boundUserId, int version, CancellationToken cancellationToken = default);
    Task<ShortStayIdentitySession> GetAsync(string sessionId, CancellationToken cancellationToken = default);
}

public sealed class StripeShortStayIdentityGateway : IStripeShortStayIdentityGateway
{
    private readonly VerificationSessionService _sessions;

    public StripeShortStayIdentityGateway(IStripeClient client)
    {
        ArgumentNullException.ThrowIfNull(client);
        _sessions = new VerificationSessionService(client);
    }

    public async Task<ShortStayIdentitySession> CreateAsync(
        string applicationId, string boundUserId, int version, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationId);
        ArgumentException.ThrowIfNullOrWhiteSpace(boundUserId);
        if (version < 1) throw new ArgumentOutOfRangeException(nameof(version));

        var options = new VerificationSessionCreateOptions
        {
            Type = "document",
            Options = new VerificationSessionOptionsOptions
            {
                Document = new VerificationSessionOptionsDocumentOptions { RequireMatchingSelfie = true }
            },
            Metadata = new Dictionary<string, string>
            {
                ["application_id"] = applicationId,
                ["bound_user_id"] = boundUserId
            }
        };
        // Length-prefixed components prevent ambiguity; the hash avoids exposing identifiers in request headers.
        var material = $"{applicationId.Length}:{applicationId}{version}";
        var key = "shortstay-identity-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(material))).ToLowerInvariant();
        try
        {
            var session = await _sessions.CreateAsync(options, new RequestOptions { IdempotencyKey = key }, cancellationToken);
            return Snapshot(session);
        }
        catch (StripeException)
        {
            // Stripe errors may contain document data or hosted links; never chain or log the provider exception.
            throw new InvalidOperationException("Identity verification provider request failed.");
        }
    }

    public async Task<ShortStayIdentitySession> GetAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);
        try
        {
            var session = await _sessions.GetAsync(sessionId, null, null, cancellationToken);
            return Snapshot(session);
        }
        catch (StripeException)
        {
            throw new InvalidOperationException("Identity verification provider request failed.");
        }
    }

    private static ShortStayIdentitySession Snapshot(VerificationSession session) =>
        new(session.Id, session.Url, session.Status);
}

public static class StripeShortStayIdentityRegistration
{
    // Nothing is registered when the explicit opt-in is absent or false.
    public static IServiceCollection AddStripeShortStayIdentity(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        if (!string.Equals(configuration["Stripe:IdentityEnabled"], "true", StringComparison.OrdinalIgnoreCase))
            return services;

        var key = configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException("Stripe:SecretKey is required when Stripe:IdentityEnabled is true.");
        services.AddSingleton<IStripeShortStayIdentityGateway>(_ =>
            new StripeShortStayIdentityGateway(new StripeClient(key)));
        return services;
    }
}
