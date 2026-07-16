using brownstone_hub_api.Dtos.MaintenanceRequest;

namespace brownstone_hub_api.Dtos.MaintenanceAgent
{
    public class MaintenanceAgentMessageDto
    {
        public string Role { get; set; } = string.Empty;   // "user" or "assistant"
        public string Content { get; set; } = string.Empty;
        public string? PhotoBase64 { get; set; }           // base64-encoded image (no data URI prefix)
        public string? PhotoMimeType { get; set; }         // e.g. "image/jpeg"
    }

    public class MaintenanceAgentChatRequestDto
    {
        public List<MaintenanceAgentMessageDto> Messages { get; set; } = [];
    }

    public class LandlordMaintenanceAgentChatRequestDto
    {
        public List<MaintenanceAgentMessageDto> Messages { get; set; } = [];
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
    }

    public class MaintenanceAgentChatResponseDto
    {
        public string Message { get; set; } = string.Empty;
        public bool Done { get; set; }
        public bool PhotoRequested { get; set; }
        public LoadMaintenanceRequestDto? MaintenanceRequest { get; set; }
    }
}
