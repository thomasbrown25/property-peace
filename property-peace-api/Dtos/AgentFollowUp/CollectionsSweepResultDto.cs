namespace brownstone_hub_api.Dtos.AgentFollowUp
{
    public class CollectionsSweepResultDto
    {
        public int LeasesReviewed { get; set; }
        public int MessagesSent { get; set; }
        public int Suppressed { get; set; }
        public int FlaggedForReview { get; set; }
        public int LateFeeRecommendations { get; set; }
        public List<string> ActionLog { get; set; } = [];
        public List<ActionLogEntryDto> ActionLogEntries { get; set; } = [];
        public List<SuppressedLeaseDto> SuppressedLeases { get; set; } = [];
    }
}
