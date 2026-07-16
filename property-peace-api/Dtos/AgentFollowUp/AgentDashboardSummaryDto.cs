namespace brownstone_hub_api.Dtos.AgentFollowUp
{
    public class AgentDashboardSummaryDto
    {
        public CollectionsAgentSummaryDto Collections { get; set; } = new();
    }

    public class CollectionsAgentSummaryDto
    {
        public int FollowUpsSentThisMonth { get; set; }
        public int ActionsThisMonth { get; set; }
        public DateTime? LastRunAt { get; set; }
    }
}
