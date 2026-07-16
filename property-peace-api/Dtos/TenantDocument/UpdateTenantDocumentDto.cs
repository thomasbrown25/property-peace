using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.TenantDocument
{
    public class UpdateTenantDocumentDto
    {
        [Required]
        public long Id { get; set; }
        
        public string? Description { get; set; }
        
        public ETenantDocumentType? DocumentType { get; set; }
        
        public DateTime? ExpirationDate { get; set; }
        
        public bool? IsDeleted { get; set; }
        
        public bool? IsRequired { get; set; }
        
        public long? LeaseId { get; set; }
        
        public bool? IsPrivate { get; set; }
    }
}

