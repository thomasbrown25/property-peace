using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// A message in a LeaseShield conversation - schema lease_shield.
    /// </summary>
    public class LeaseShieldMessage
    {
        [Key]
        public long Id { get; set; }

        public long ConversationId { get; set; }
        [ForeignKey(nameof(ConversationId))]
        public LeaseShieldConversation Conversation { get; set; } = null!;

        /// <summary> "user" or "assistant" </summary>
        [Required]
        [MaxLength(10)]
        public string Role { get; set; } = string.Empty;

        /// <summary> 2-letter state code used for this message (e.g. for assistant answers, which state's law was used). </summary>
        [MaxLength(2)]
        public string? State { get; set; }

        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string Content { get; set; } = string.Empty;

        [Column(TypeName = "nvarchar(max)")]
        public string? SourceCitationsJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
