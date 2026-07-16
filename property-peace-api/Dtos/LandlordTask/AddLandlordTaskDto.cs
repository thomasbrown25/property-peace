using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LandlordTask
{
    public class AddLandlordTaskDto
    {
        [Required]
        [MaxLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public DateTime DueDate { get; set; }

        public ETaskCategory Category { get; set; } = ETaskCategory.Task;

        public long? PropertyId { get; set; }

        public bool IsRecurring { get; set; } = false;

        public ERecurrenceType RecurrenceType { get; set; } = ERecurrenceType.None;

        public int RecurrenceInterval { get; set; } = 1;

        public DateTime? RecurrenceEndDate { get; set; }
    }
}
