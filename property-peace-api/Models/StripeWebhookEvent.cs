using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Models
{
    [Index(nameof(StripeEventId), IsUnique = true)]
    public class StripeWebhookEvent
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string StripeEventId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string EventType { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? PayloadObjectId { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Processing";

        public int ProcessingAttempts { get; set; } = 1;

        [MaxLength(2000)]
        public string? LastError { get; set; }

        public DateTime? StripeCreatedAt { get; set; }
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ProcessedAt { get; set; }
        public DateTime? FailedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
