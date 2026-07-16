namespace brownstone_hub_api.Dtos.AgentFollowUp
{
    public class ActionLogEntryDto
    {
        public string Message { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public string Type { get; set; } = string.Empty; // "sent", "flagged", "late_fee"
    }
}
