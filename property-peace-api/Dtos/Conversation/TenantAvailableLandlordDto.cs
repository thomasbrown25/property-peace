namespace brownstone_hub_api.Dtos.Conversation
{
    public class TenantAvailableLandlordDto
    {
        public long LandlordUserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? PropertyName { get; set; }
    }

    public class StartTenantConversationDto
    {
        public long LandlordUserId { get; set; }
    }
}
