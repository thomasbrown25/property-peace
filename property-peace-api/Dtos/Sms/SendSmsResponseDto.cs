namespace brownstone_hub_api.Dtos.Sms
{
    public class SendSmsResponseDto
    {
        public bool Success { get; set; }
        public string? MessageId { get; set; }
        public string? ErrorMessage { get; set; }
    }
}

