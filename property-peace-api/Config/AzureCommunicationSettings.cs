namespace brownstone_hub_api.Config
{
    public class AzureCommunicationSettings
    {
        public string ConnectionString { get; set; } = string.Empty;
        public string SenderAddress { get; set; } = string.Empty; // e.g., "DoNotReply@mail.brownstonehub.com"
        /// <summary>Optional. Used only for logging. The name shown in recipients' inboxes is configured in Azure (Email Communication Service → Domains → Mail From → Display Name), not by the SDK.</summary>
        public string? SenderDisplayName { get; set; }
        public string SmsFromPhoneNumber { get; set; } = string.Empty; // e.g., "+1234567890" - Your ACS phone number
    }
}

