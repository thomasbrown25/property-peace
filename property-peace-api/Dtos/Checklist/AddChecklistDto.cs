using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Checklist
{
    public class AddChecklistDto
    {
        public ETenantDocumentType ChecklistType { get; set; } // MoveInChecklist (40) or MoveOutChecklist (41)
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? LeaseId { get; set; }
        public long? CounterpartChecklistId { get; set; }
        public long? TenantId { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime? InspectionDate { get; set; }
        public string? GeneralNotes { get; set; }
        public string? ConditionNotes { get; set; }
        public List<string>? RoomNames { get; set; }
        public List<string>? BeforeMoveInImagesBlobNames { get; set; }
        public List<string>? BeforeMoveInImagesUrls { get; set; }
        public List<string>? AfterMoveOutImagesBlobNames { get; set; }
        public List<string>? AfterMoveOutImagesUrls { get; set; }
        public List<AddChecklistItemDto> Items { get; set; } = [];
    }
}

