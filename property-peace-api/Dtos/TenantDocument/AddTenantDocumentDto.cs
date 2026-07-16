using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TenantDocument
{
    public class AddTenantDocumentDto
    {
        /// <summary>Required when uploading per-tenant. Null when uploading at lease level (no tenants yet).</summary>
        public long? TenantId { get; set; }
        
        [Required]
        public string FileName { get; set; } = string.Empty;
        
        public string? Description { get; set; }
        
        [Required]
        public ETenantDocumentType DocumentType { get; set; }
        
        public DateTime? ExpirationDate { get; set; }
        
        public bool IsRequired { get; set; } = false;
        
        public long? LeaseId { get; set; }
        
        /// <summary>If true, document is not shown to tenants (landlord-only).</summary>
        public bool IsPrivate { get; set; } = false;
        
        // These are set by the service during upload
        public string BlobName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
    }
}

