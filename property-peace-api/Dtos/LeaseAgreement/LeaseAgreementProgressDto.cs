using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeaseAgreement;

/// <summary>
/// Durable builder progress, independent of the legacy lease-setup IsDrafted flag.
/// A saved supplemental section does not create or finalize a document instance.
/// </summary>
public sealed class LeaseAgreementProgressDto
{
    public long Id { get; init; }
    public long LeaseId { get; init; }
    public bool? IsDrafted { get; init; }
    public bool IsDraft { get; init; }
    public bool CanResume { get; init; }
    public bool IsFinalized { get; init; }
    public bool IsLeaseSpecificsComplete { get; init; }
    public bool IsRentDepositFeesComplete { get; init; }
    public bool IsPeopleOnLeaseComplete { get; init; }
    public bool IsPetsSmokingOtherComplete { get; init; }
    public bool IsUtilitiesMaintenanceKeysComplete { get; init; }
    public bool IsProvisionsAttachmentsComplete { get; init; }

    public static LeaseAgreementProgressDto From(Models.LeaseAgreement agreement, bool isFinalized)
    {
        var locked = isFinalized || agreement.LandlordSignedAt != null
            || agreement.SignatureCompletedAt != null
            || !string.IsNullOrEmpty(agreement.DocuSignEnvelopeId)
            || agreement.SignatureStatus == ESignatureStatus.Completed;
        return new()
        {
            Id = agreement.Id, LeaseId = agreement.LeaseId, IsDrafted = agreement.IsDrafted,
            IsDraft = !locked, CanResume = !locked, IsFinalized = isFinalized,
            IsLeaseSpecificsComplete = agreement.IsLeaseSpecificsComplete,
            IsRentDepositFeesComplete = agreement.IsRentDepositFeesComplete,
            IsPeopleOnLeaseComplete = agreement.IsPeopleOnLeaseComplete,
            IsPetsSmokingOtherComplete = agreement.IsPetsSmokingOtherComplete,
            IsUtilitiesMaintenanceKeysComplete = agreement.IsUtilitiesMaintenanceKeysComplete,
            IsProvisionsAttachmentsComplete = agreement.IsProvisionsAttachmentsComplete
        };
    }
}
