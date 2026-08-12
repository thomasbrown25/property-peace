using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Lease;

/// <summary>Provider facts prepared before entering the single scoped database transaction.</summary>
public sealed record SignatureSyncUpdate(
    string EnvelopeId,
    ESignatureStatus Status,
    DateTime? CompletedAt,
    DateTime? ExpiresAt,
    DateTime? LandlordSignedAt,
    string? LandlordSignedBy,
    string? SignedDocumentBlobName,
    string? SignedDocumentBlobUrl,
    IReadOnlyDictionary<string, DateTime> SignedRecipients);

public sealed record SignatureSyncApplyResult(
    bool Applied,
    ESignatureStatus Status,
    DateTime? LandlordSignedAt,
    int TenantSignaturesUpdated,
    bool SignedDocumentApplied);
