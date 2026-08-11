using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Lease;

/// <summary>Authenticated DocuSign Connect data that is safe to apply to an already-resolved envelope.</summary>
public sealed record DocuSignConnectUpdate(
    string EnvelopeId,
    ESignatureStatus Status,
    DateTime? CompletedAt,
    IReadOnlyDictionary<string, DateTime> SignedRecipients,
    DateTime? EventOccurredAt = null);

public sealed record DocuSignConnectApplyResult(
    bool Applied,
    int TenantSignaturesUpdated,
    ESignatureStatus? AuthoritativeStatus = null,
    DateTime? AuthoritativeCompletedAt = null);
