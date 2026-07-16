namespace brownstone_hub_api.Dtos.MaintenanceRequest
{
    public class MaintenanceAnalysisResult
    {
        public string Title { get; set; } = string.Empty; // AI-generated title
        public long CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty; // "Low", "Medium", or "High"
        public string CategoryReasoning { get; set; } = string.Empty;
        public string PriorityReasoning { get; set; } = string.Empty;
    }
}
