using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class LeaseAgreement
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }

        public bool? IsDrafted { get; set; }

        // Builder step completion
        public bool IsLeaseSpecificsComplete { get; set; } = false;
        public bool IsRentDepositFeesComplete { get; set; } = false;
        public bool IsPeopleOnLeaseComplete { get; set; } = false;
        public bool IsPetsSmokingOtherComplete { get; set; } = false;
        public bool IsUtilitiesMaintenanceKeysComplete { get; set; } = false;
        public bool IsProvisionsAttachmentsComplete { get; set; } = false;

        // E-Signature
        public ESignatureStatus? SignatureStatus { get; set; }
        public string? DocuSignEnvelopeId { get; set; }
        public DateTime? SignatureSentAt { get; set; }
        public DateTime? SignatureCompletedAt { get; set; }
        public DateTime? SignatureExpiresAt { get; set; }
        public string? LandlordSignature { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        public string? LandlordSignedBy { get; set; }
        public string? SignedDocumentBlobName { get; set; }
        public string? SignedDocumentBlobUrl { get; set; }

        public Lease Lease { get; set; } = null!;
    }
}
