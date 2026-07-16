using brownstone_hub_api.Enums;
using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a document associated with a tenant
    /// </summary>
    public class TenantDocument : IImageEntity
    {
        public long Id { get; set; }
        
        // IImageEntity implementation
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        public long RefId { get; set; } // TenantId
        
        // Document metadata
        public string FileName { get; set; } = string.Empty; // Original filename
        public string? Description { get; set; } // Optional description/notes
        public ETenantDocumentType DocumentType { get; set; }
        
        // Expiration tracking
        public DateTime? ExpirationDate { get; set; } // For leases, insurance, IDs, etc.
        
        // Document status
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsRequired { get; set; } = false; // Whether this document is required
        /// <summary>If true, document is not shown to tenants (landlord-only). If false, shown in tenant documents.</summary>
        public bool IsPrivate { get; set; } = false;
        
        // Relationships
        public long? TenantId { get; set; } // Null when uploaded at lease level (no tenants yet)
        public Tenant? Tenant { get; set; }
        
        public long? LeaseId { get; set; } // Optional: link to specific lease
        public Lease? Lease { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; } // UserId who uploaded
        public long? UpdatedBy { get; set; } // UserId who last updated
    }
}

