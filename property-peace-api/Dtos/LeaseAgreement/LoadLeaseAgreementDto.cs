using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeaseAgreement
{
    public class LoadLeaseAgreementDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public bool? IsDrafted { get; set; }

        // Builder step completion
        public bool IsLeaseSpecificsComplete { get; set; }
        public bool IsRentDepositFeesComplete { get; set; }
        public bool IsPeopleOnLeaseComplete { get; set; }
        public bool IsPetsSmokingOtherComplete { get; set; }
        public bool IsUtilitiesMaintenanceKeysComplete { get; set; }
        public bool IsProvisionsAttachmentsComplete { get; set; }

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
    }
}
