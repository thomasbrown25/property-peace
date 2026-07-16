using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Lease
{
    public class SyncSignatureStatusResultDto
    {
        public DateTime? LandlordSignedAt { get; set; }
        public ESignatureStatus SignatureStatus { get; set; }
        public int TenantSignaturesUpdated { get; set; }
        public bool SignedDocumentDownloaded { get; set; }
    }
}
