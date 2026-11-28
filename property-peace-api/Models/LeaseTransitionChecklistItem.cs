using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class LeaseTransitionChecklistItem
    {
        public long Id { get; set; }
        public long LeaseTransitionChecklistId { get; set; }
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int SortOrder { get; set; }
        public bool AllowNotApplicable { get; set; }
        public ELeaseTransitionItemStatus Status { get; set; } = ELeaseTransitionItemStatus.Pending;
        public string? NotApplicableReason { get; set; }
        public DateTime? CompletedAt { get; set; }
        public LeaseTransitionChecklist Checklist { get; set; } = null!;
    }
}
