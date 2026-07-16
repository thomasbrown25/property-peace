using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Reusable document templates for common documents (lease agreements, notices, etc.)
    /// </summary>
    public class DocumentTemplate
    {
        public long Id { get; set; }
        
        public string Name { get; set; } = string.Empty; // Template name
        public string? Description { get; set; } // Template description
        public ETenantDocumentType DocumentType { get; set; } // Type of document this template is for
        
        // Template content
        public string? TemplateContent { get; set; } // HTML/text content of template
        public string? BlobName { get; set; } // If template is a file (PDF, DOCX, etc.)
        public string? BlobUrl { get; set; } // URL to template file
        
        // Template metadata
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool IsDefault { get; set; } = false; // Default template for this document type
        
        // Variables/placeholders that can be replaced in template
        public string? VariablePlaceholders { get; set; } // JSON array of available placeholders
        
        // Relationships
        public long LandlordId { get; set; } // Templates are per landlord
        public User Landlord { get; set; } = null!;
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
    }
}

