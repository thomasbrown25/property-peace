namespace brownstone_hub_api.Dtos.Sms
{
    public class SendBulkSmsResponseDto
    {
        public int SuccessCount { get; set; }
        public int FailureCount { get; set; }
        public int TotalCount { get; set; }
    }
}

