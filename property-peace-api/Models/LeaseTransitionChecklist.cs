using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class LeaseTransitionChecklist
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long LandlordId { get; set; }
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? LeaseId { get; set; }
        public ELeaseTransitionPhase Phase { get; set; }
        public string RequestId { get; set; } = string.Empty;
        public long? ConditionReportId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public Organization Organization { get; set; } = null!;
        public User Landlord { get; set; } = null!;
        public Property Property { get; set; } = null!;
        public Unit? Unit { get; set; }
        public Lease? Lease { get; set; }
        public Checklist? ConditionReport { get; set; }
        public ICollection<LeaseTransitionChecklistItem> Items { get; set; } = [];
    }
}
