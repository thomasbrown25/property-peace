using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class StateLawSource
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(2)]
        public string State { get; set; } = string.Empty;

        [Column(TypeName = "nvarchar(max)")]
        public string? LateFeeUrl { get; set; }

        [Column(TypeName = "nvarchar(max)")]
        public string? SecurityDepositUrl { get; set; }

        public DateTime? UpdatedAt { get; set; }
    }
}
