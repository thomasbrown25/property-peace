namespace brownstone_hub_api.Dtos.ActionSuppression
{
    public class AddActionSuppressionDto
    {
        public string ActionType { get; set; } = string.Empty;
        public long EntityId { get; set; }
        public DateTime? SuppressedUntil { get; set; } // Null means permanently suppressed
        public string? Reason { get; set; }
    }
}
