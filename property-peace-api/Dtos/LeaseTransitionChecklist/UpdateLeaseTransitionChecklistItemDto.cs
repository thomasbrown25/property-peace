using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeaseTransitionChecklist
{
    public class UpdateLeaseTransitionChecklistItemDto
    {
        public ELeaseTransitionItemStatus Status { get; set; }
        public string? NotApplicableReason { get; set; }
    }
}
