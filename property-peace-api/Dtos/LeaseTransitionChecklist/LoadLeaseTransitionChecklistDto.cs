using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeaseTransitionChecklist
{
    public class LoadLeaseTransitionChecklistDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public long? LeaseId { get; set; }
        public ELeaseTransitionPhase Phase { get; set; }
        public string RequestId { get; set; } = string.Empty;
        public long? ConditionReportId { get; set; }
        public LoadChecklistDto? ConditionReport { get; set; }
        public List<LoadLeaseTransitionChecklistItemDto> Items { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class LoadLeaseTransitionChecklistItemDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool AllowNotApplicable { get; set; }
        public ELeaseTransitionItemStatus Status { get; set; }
        public string? NotApplicableReason { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
}
