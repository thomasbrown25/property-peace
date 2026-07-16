using brownstone_hub_api.Dtos.Property;

namespace brownstone_hub_api.Dtos.ApplicationInvite
{
    public class ValidateApplicationInviteTokenDto
    {
        public bool IsValid { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Email { get; set; }
        public long? PropertyId { get; set; }
        public long? UnitId { get; set; }
        public LoadPropertyDto? Property { get; set; }
    }
}

