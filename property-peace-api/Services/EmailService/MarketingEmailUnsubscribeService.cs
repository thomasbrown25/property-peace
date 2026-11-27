using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.EmailService;

public sealed class MarketingEmailUnsubscribeService(
    DataContext context,
    IDataProtectionProvider protection,
    IConfiguration configuration,
    TimeProvider timeProvider)
{
    public const string Route = "api/email/unsubscribe";

    private readonly IDataProtector _protector = protection.CreateProtector("PropertyPeace.MarketingEmailUnsubscribe.v1");

    public string BuildUnsubscribeUrl(string email, string? requestHost = null)
    {
        var baseUrl = configuration["MarketingEmail:PublicApiBaseUrl"]
            ?? (requestHost is "api-dev.propertypeace.io" or "property-peace-api-dev.azurewebsites.net"
                ? "https://api-dev.propertypeace.io"
                : "https://api.propertypeace.io");

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var origin) ||
            (origin.Scheme != Uri.UriSchemeHttps && !(origin.IsLoopback && origin.Scheme == Uri.UriSchemeHttp)) ||
            origin.UserInfo.Length != 0 || origin.Query.Length != 0 || origin.Fragment.Length != 0)
        {
            throw new InvalidOperationException("The marketing email API base URL must be an absolute HTTPS URL.");
        }

        // Fragments stay out of request URLs and access logs. The form submits the token in the POST body.
        return $"{origin.AbsoluteUri.TrimEnd('/')}/{Route}#{_protector.Protect(HashEmail(email))}";
    }

    public Task<bool> IsUnsubscribedAsync(string email, CancellationToken cancellationToken = default)
    {
        return HasOptOutAsync(HashEmail(email), cancellationToken);
    }

    public async Task<bool> UnsubscribeAsync(string? token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 512)
        {
            return false;
        }

        string emailHash;
        try
        {
            emailHash = _protector.Unprotect(token);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            return false;
        }

        if (await HasOptOutAsync(emailHash, cancellationToken))
        {
            return true;
        }

        var entry = context.Add(new MarketingEmailOptOut
        {
            EmailHash = emailHash,
            UnsubscribedAtUtc = timeProvider.GetUtcNow()
        });
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent request may already have inserted this address's unique opt-out.
            entry.State = EntityState.Detached;
            if (!await HasOptOutAsync(emailHash, cancellationToken))
            {
                throw;
            }
        }

        return true;
    }

    private Task<bool> HasOptOutAsync(string emailHash, CancellationToken cancellationToken) =>
        context.Set<MarketingEmailOptOut>().AnyAsync(optOut => optOut.EmailHash == emailHash, cancellationToken);

    private static string HashEmail(string email) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(email.Trim().ToUpperInvariant())));
}
