using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadChecklistDto
    {
        public long Id { get; set; }
        public ETenantDocumentType ChecklistType { get; set; }
        public string ChecklistTypeName { get; set; } = string.Empty;
        
        // Property/Unit Information
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public long? LeaseId { get; set; }
        public DateTime? LeaseStartDate { get; set; }
        public DateTime? LeaseEndDate { get; set; }
        public long? TenantId { get; set; }
        public string? TenantName { get; set; }
        
        // Checklist Metadata
        public string Title { get; set; } = string.Empty;
        public DateTime? InspectionDate { get; set; }
        public DateTime? CompletedAt { get; set; }
        public bool IsCompleted { get; set; } = false;
        
        // Participants
        public long? ConductedBy { get; set; }
        public string? ConductedByName { get; set; }
        public string? TenantSignature { get; set; }
        public string? LandlordSignature { get; set; }
        public DateTime? TenantSignedAt { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        
        // Notes
        public string? GeneralNotes { get; set; }
        public string? ConditionNotes { get; set; }
        
        // Before/After Images (JSON arrays)
        public List<string>? BeforeMoveInImagesBlobNames { get; set; }
        public List<string>? BeforeMoveInImagesUrls { get; set; }
        public List<string>? AfterMoveOutImagesBlobNames { get; set; }
        public List<string>? AfterMoveOutImagesUrls { get; set; }
        
        // Relationships
        public long LandlordId { get; set; }
        
        // Items
        public List<LoadChecklistItemDto> Items { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

