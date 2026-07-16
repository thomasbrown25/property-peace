
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class LeaseHistory
    {
        public long Id { get; set; }
        public long OriginalLeaseId { get; set; } // Reference to the original lease
        public long UnitId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal RentAmount { get; set; }
        public decimal DepositAmount { get; set; }
        public int LeaseLength { get; set; }
        public string RentFrequency { get; set; } = "Monthly";
        public int RentDueDay { get; set; }
        public decimal OverdueAmount { get; set; }
        public bool CustomDateSelected { get; set; }
        public DateTime ArchivedAt { get; set; } = DateTime.UtcNow;

        // E-Signature fields (preserved for history)
        public ESignatureStatus SignatureStatus { get; set; } = ESignatureStatus.NotSent;
        public string? DocuSignEnvelopeId { get; set; }
        public DateTime? SignatureSentAt { get; set; }
        public DateTime? SignatureCompletedAt { get; set; }
        public DateTime? SignatureExpiresAt { get; set; }
        public string? LandlordSignature { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        public string? LandlordSignedBy { get; set; } // First and last name of user who signed as landlord
        public string? SignedDocumentBlobName { get; set; }
        public string? SignedDocumentBlobUrl { get; set; }
        public long? LeaseTemplateId { get; set; }

        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        // Tenant information (stored as JSON or separate table - for now, we'll keep reference)
        // Note: Tenants are not deleted, they remain in the Tenants table
    }
}

