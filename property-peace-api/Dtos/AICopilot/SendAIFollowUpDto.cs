namespace brownstone_hub_api.Dtos.AICopilot
{
    public class SendAIFollowUpDto
    {
        public string ActionType { get; set; } = string.Empty; // e.g., "sendAIFollowUp_OverdueRent"
        public long EntityId { get; set; } // LeaseId, TenantId, etc.
        public Dictionary<string, object>? Context { get; set; } // Additional context for AI prompt generation

        // Optional user-edited overrides — if provided, skip AI generation and use these directly
        public string? InAppMessageOverride { get; set; }
        public string? EmailSubjectOverride { get; set; }
        public string? EmailBodyOverride { get; set; }
    }
}
