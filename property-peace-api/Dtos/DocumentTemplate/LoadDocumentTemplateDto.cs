using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.DocumentTemplate
{
    public class LoadDocumentTemplateDto
    {
        public long Id { get; set; }
        
        public long LandlordId { get; set; }
        
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public ETenantDocumentType DocumentType { get; set; }
        public string DocumentTypeName { get; set; } = string.Empty;
        
        public string? TemplateContent { get; set; }
        public string? BlobName { get; set; }
        public string? BlobUrl { get; set; }
        
        public bool IsActive { get; set; }
        public bool IsDefault { get; set; }
        
        public string? VariablePlaceholders { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

