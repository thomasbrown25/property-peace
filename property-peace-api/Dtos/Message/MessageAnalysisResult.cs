namespace brownstone_hub_api.Dtos.Message
{
    public class MessageAnalysisResult
    {
        public string Summary { get; set; } = string.Empty;
        public List<UrgentItem> UrgentItems { get; set; } = [];
        public bool HasUrgentItems => UrgentItems?.Any() ?? false;
    }

    public class UrgentItem
    {
        public string Id { get; set; } = string.Empty; // Unique identifier for this urgent item
        public string Type { get; set; } = string.Empty; // "maintenance", "payment", "safety", "lease_violation", etc.
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty; // "high", "medium", "low"
        public string? MessageExcerpt { get; set; }
    }
}

