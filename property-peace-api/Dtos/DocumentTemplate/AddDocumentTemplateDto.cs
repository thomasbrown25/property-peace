using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.DocumentTemplate
{
    public class AddDocumentTemplateDto
    {
        [Required]
        public long LandlordId { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [Required]
        public ETenantDocumentType DocumentType { get; set; }
        
        public string? TemplateContent { get; set; } // HTML/text content
        
        public string? BlobName { get; set; } // If template is a file
        public string? BlobUrl { get; set; } // URL to template file
        
        public bool IsDefault { get; set; } = false;
        
        public string? VariablePlaceholders { get; set; } // JSON array
    }
}

