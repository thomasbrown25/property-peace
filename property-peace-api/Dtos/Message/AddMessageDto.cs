using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.Message
{
    public class AddMessageDto
    {
        public long ConversationId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string? AttachmentName { get; set; }
        public long? ReplyToMessageId { get; set; } // If replying to another message
        public string? ClientRequestId { get; set; }
        /// <summary>The trusted ingestion channel. Public clients should omit this (in-app is the default).</summary>
        public string? Channel { get; set; }
        /// <summary>Trusted provider-ingestion fingerprint; never accepted from public JSON clients.</summary>
        [JsonIgnore]
        public string? TrustedProviderPayloadHash { get; set; }
    }
}

