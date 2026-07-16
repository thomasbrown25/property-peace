using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LandlordTask
{
    public class UpdateLandlordTaskDto
    {
        [Required]
        public long Id { get; set; }

        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public DateTime DueDate { get; set; }

        public ETaskCategory Category { get; set; } = ETaskCategory.Task;

        public ETaskStatus Status { get; set; } = ETaskStatus.Open;

        public long? PropertyId { get; set; }

        public bool IsRecurring { get; set; } = false;

        public ERecurrenceType RecurrenceType { get; set; } = ERecurrenceType.None;

        public int RecurrenceInterval { get; set; } = 1;

        public DateTime? RecurrenceEndDate { get; set; }
    }
}
