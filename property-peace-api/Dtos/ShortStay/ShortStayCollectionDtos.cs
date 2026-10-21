using brownstone_hub_api.Models;
using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.ShortStay;

// Reject extra client-supplied account identifiers, evidence, narratives and other fields.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SaveShortStayCollectionDraftDto(long[]? PropertyIds, bool AuthorityAttested, string? FeePolicyConsentVersion);

public sealed record ShortStayCollectionStatusDto(
    long Id, ShortStayCollectionApplicationStatus Status, long[] PropertyIds, long RowVersion,
    bool AuthorityAttested, string? FeePolicyConsentVersion, DateTimeOffset? SubmittedAt,
    string[] NextSteps);

public sealed record ShortStayIdentityRedirectDto(string Url);

public sealed record ShortStayCollectionRequirementsDto(
    bool Available, string? FeePolicyConsentVersion, string? FeePolicyUrl,
    bool IdentityEnabled, string? ReasonCode);
