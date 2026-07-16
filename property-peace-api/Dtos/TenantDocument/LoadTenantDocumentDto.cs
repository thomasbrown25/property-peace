using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TenantDocument
{
    public class LoadTenantDocumentDto
    {
        public long Id { get; set; }
        
        public long? TenantId { get; set; } // Null for lease-level documents (no tenant yet)
        public string? TenantName { get; set; } // Firstname + Lastname
        
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        
        public string FileName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public ETenantDocumentType DocumentType { get; set; }
        public string DocumentTypeName { get; set; } = string.Empty; // Human-readable name
        
        public DateTime? ExpirationDate { get; set; }
        public bool IsExpired { get; set; }
        public bool IsExpiringSoon { get; set; } // Expires within 30 days
        
        public bool IsActive { get; set; }
        public bool IsRequired { get; set; }
        
        public long? LeaseId { get; set; }
        public string? LeaseInfo { get; set; } // Property/Unit info for the lease
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        
        public long? CreatedBy { get; set; } // UserId who uploaded the document

        /// <summary>If true, document is not shown to tenants (landlord-only).</summary>
        public bool IsPrivate { get; set; }
    }
}

