using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class JobRunHistory
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string JobId { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string JobName { get; set; } = string.Empty;

        [Required]
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Running"; // Running, Completed, Failed

        [Column(TypeName = "nvarchar(max)")]
        public string? Message { get; set; }
    }
}
