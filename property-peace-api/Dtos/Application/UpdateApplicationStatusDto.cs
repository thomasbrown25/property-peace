using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Application
{
    public class UpdateApplicationStatusDto
    {
        public EApplicationStatus Status { get; set; }
        public string? RejectionReason { get; set; }
        public string? ReviewNotes { get; set; }
    }
}
