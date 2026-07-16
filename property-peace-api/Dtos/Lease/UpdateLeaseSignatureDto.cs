using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Lease
{
    /// <summary>
    /// DTO for updating lease signature information
    /// </summary>
    public class UpdateLeaseSignatureDto
    {
        public long LeaseId { get; set; }
        public ESignatureStatus SignatureStatus { get; set; }
        public string? DocuSignEnvelopeId { get; set; }
        public DateTime? SignatureSentAt { get; set; }
        public DateTime? SignatureCompletedAt { get; set; }
        public DateTime? SignatureExpiresAt { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        public string? LandlordSignedBy { get; set; } // First and last name of user who signed
    }
}

