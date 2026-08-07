using System.Buffers.Binary;
using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace brownstone_hub_api.Services.Leads;

public interface IPublicLeadSessionService
{
    string Issue(long listingId, long? verifiedLeadId);
    long? Resolve(string? session, long expectedListingId);
    PublicLeadBookingAuthority? ResolveBookingAuthority(string? session, long expectedListingId);
    string IssueManagement(long listingId, long showingId, long leadId);
    PublicShowingManagementAuthority? ResolveManagementAuthority(string? session, long expectedListingId,
        long expectedShowingId);
}

public sealed class PublicLeadBookingAuthority
{
    internal PublicLeadBookingAuthority(long listingId, long leadId) => (ListingId, LeadId) = (listingId, leadId);
    internal long ListingId { get; }
    internal long LeadId { get; }
}

/// <summary>A purpose-specific, listing/showing-bound authority; it is never constructed from caller IDs alone.</summary>
public sealed class PublicShowingManagementAuthority
{
    internal PublicShowingManagementAuthority(long listingId, long showingId, long leadId)
        => (ListingId, ShowingId, LeadId) = (listingId, showingId, leadId);
    internal long ListingId { get; }
    internal long ShowingId { get; }
    internal long LeadId { get; }
}

/// <summary>Issues short-lived, purpose-bound opaque browser sessions. Failed verification sessions are decoys.</summary>
public sealed class PublicLeadSessionService(IDataProtectionProvider provider, TimeProvider clock)
    : IPublicLeadSessionService
{
    private readonly IDataProtector protector = provider.CreateProtector("public-lead-browser-session-v1");
    private readonly IDataProtector managementProtector = provider.CreateProtector("public-showing-management-session-v1");

    public string Issue(long listingId, long? verifiedLeadId)
    {
        Span<byte> payload = stackalloc byte[24];
        BinaryPrimitives.WriteInt64BigEndian(payload, listingId);
        var subject = verifiedLeadId ?? -RandomNumberGenerator.GetInt32(1, int.MaxValue);
        BinaryPrimitives.WriteInt64BigEndian(payload[8..], subject);
        BinaryPrimitives.WriteInt64BigEndian(payload[16..], clock.GetUtcNow().AddMinutes(15).UtcTicks);
        return Convert.ToBase64String(protector.Protect(payload.ToArray()));
    }

    public long? Resolve(string? session, long expectedListingId)
    {
        if (string.IsNullOrWhiteSpace(session)) return null;
        try
        {
            var payload = protector.Unprotect(Convert.FromBase64String(session));
            if (payload.Length != 24 || BinaryPrimitives.ReadInt64BigEndian(payload) != expectedListingId ||
                BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(16)) < clock.GetUtcNow().UtcTicks) return null;
            var leadId = BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(8));
            return leadId > 0 ? leadId : null;
        }
        catch (CryptographicException) { return null; }
        catch (FormatException) { return null; }
    }

    public PublicLeadBookingAuthority? ResolveBookingAuthority(string? session, long expectedListingId) =>
        Resolve(session, expectedListingId) is { } leadId ? new(expectedListingId, leadId) : null;

    public string IssueManagement(long listingId, long showingId, long leadId)
    {
        Span<byte> payload = stackalloc byte[32];
        BinaryPrimitives.WriteInt64BigEndian(payload, listingId);
        BinaryPrimitives.WriteInt64BigEndian(payload[8..], showingId);
        BinaryPrimitives.WriteInt64BigEndian(payload[16..], leadId);
        BinaryPrimitives.WriteInt64BigEndian(payload[24..], clock.GetUtcNow().AddMinutes(10).UtcTicks);
        return Convert.ToBase64String(managementProtector.Protect(payload.ToArray()));
    }

    public PublicShowingManagementAuthority? ResolveManagementAuthority(string? session, long expectedListingId,
        long expectedShowingId)
    {
        if (string.IsNullOrWhiteSpace(session)) return null;
        try
        {
            var payload = managementProtector.Unprotect(Convert.FromBase64String(session));
            if (payload.Length != 32 || BinaryPrimitives.ReadInt64BigEndian(payload) != expectedListingId ||
                BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(8)) != expectedShowingId ||
                BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(24)) < clock.GetUtcNow().UtcTicks) return null;
            var leadId = BinaryPrimitives.ReadInt64BigEndian(payload.AsSpan(16));
            return leadId > 0 ? new(expectedListingId, expectedShowingId, leadId) : null;
        }
        catch (CryptographicException) { return null; }
        catch (FormatException) { return null; }
    }
}
