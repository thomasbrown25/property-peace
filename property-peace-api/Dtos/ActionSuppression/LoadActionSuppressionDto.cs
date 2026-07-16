namespace brownstone_hub_api.Dtos.ActionSuppression
{
    public class LoadActionSuppressionDto
    {
        public long Id { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public long EntityId { get; set; }
        public long OrganizationId { get; set; }
        public DateTime? SuppressedUntil { get; set; } // Null means permanently suppressed
        public DateTime SuppressedAt { get; set; }
        public long CreatedBy { get; set; }
        public string? Reason { get; set; }
        public bool IsActive { get; set; }
    }
}
