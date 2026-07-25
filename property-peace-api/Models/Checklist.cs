using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a move-in or move-out inspection checklist
    /// </summary>
    public class Checklist
    {
        public long Id { get; set; }
        
        // Checklist Type
        public ETenantDocumentType ChecklistType { get; set; } // MoveInChecklist (40) or MoveOutChecklist (41)
        
        // Associated Entities
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        public long? UnitId { get; set; }
        public Unit? Unit { get; set; }
        public long? LeaseId { get; set; }
        public Lease? Lease { get; set; }
        public long? CounterpartChecklistId { get; set; } // Paired move-in/move-out checklist
        public long? TenantId { get; set; } // For move-out, which tenant
        public Tenant? Tenant { get; set; }
        
        // Checklist Metadata
        public string Title { get; set; } = string.Empty; // e.g., "Move-In Inspection - Unit 2A"
        public DateTime? InspectionDate { get; set; }
        public DateTime? CompletedAt { get; set; }
        public bool IsCompleted { get; set; } = false;
        
        // Participants
        public long? ConductedBy { get; set; } // UserId who conducted inspection
        public string? TenantSignature { get; set; } // Base64 signature or reference
        public string? LandlordSignature { get; set; } // Base64 signature or reference
        public DateTime? TenantSignedAt { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        
        // Notes
        public string? GeneralNotes { get; set; }
        public string? ConditionNotes { get; set; } // Overall condition assessment
        public string? RoomNamesJson { get; set; } // JSON array keeps empty/custom rooms persisted and linked across move-in/out
        
        // Before/After Images (for move-in/move-out)
        public string? BeforeMoveInImagesBlobNames { get; set; } // JSON array of blob names for before move-in images
        public string? BeforeMoveInImagesUrls { get; set; } // JSON array of URLs for before move-in images
        public string? AfterMoveOutImagesBlobNames { get; set; } // JSON array of blob names for after move-out images
        public string? AfterMoveOutImagesUrls { get; set; } // JSON array of URLs for after move-out images
        
        // Relationships
        public long LandlordId { get; set; }
        public User Landlord { get; set; } = null!;
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public ICollection<ChecklistItem> Items { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}

