using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeaseTransitionChecklist
{
    public class CreateLeaseTransitionChecklistDto
    {
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public long? LeaseId { get; set; }
        public ELeaseTransitionPhase Phase { get; set; }
        public string RequestId { get; set; } = string.Empty;
    }
}
