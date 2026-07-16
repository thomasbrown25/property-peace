using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class LandlordTask
    {
        [Key]
        public long Id { get; set; }

        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        public long? PropertyId { get; set; }

        [ForeignKey(nameof(PropertyId))]
        public Property? Property { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public DateTime DueDate { get; set; }

        public ETaskCategory Category { get; set; } = ETaskCategory.Task;

        public ETaskStatus Status { get; set; } = ETaskStatus.Open;

        public bool IsRecurring { get; set; } = false;

        public ERecurrenceType RecurrenceType { get; set; } = ERecurrenceType.None;

        public int RecurrenceInterval { get; set; } = 1;

        public DateTime? RecurrenceEndDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
