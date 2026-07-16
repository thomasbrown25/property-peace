namespace brownstone_hub_api.Config
{
    public class TwilioSettings
    {
        public string AccountSid { get; set; } = string.Empty;
        public string AuthToken { get; set; } = string.Empty;
        public string FromPhoneNumber { get; set; } = string.Empty; // e.g., "+1234567890" - Your Twilio phone number
        public string? MessagingServiceSid { get; set; } // e.g., "MGxxxxx" — preferred over FromPhoneNumber when using a Messaging Service
    }
}
