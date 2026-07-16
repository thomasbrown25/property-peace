namespace brownstone_hub_api.Dtos.TimeEntry
{
    public class ApproveTimeEntryDto
    {
        public bool IsApproved { get; set; }
        public string? RejectionReason { get; set; }
    }
}
