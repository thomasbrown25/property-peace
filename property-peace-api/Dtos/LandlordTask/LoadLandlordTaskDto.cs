using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LandlordTask
{
    public class LoadLandlordTaskDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }
        public ETaskCategory Category { get; set; }
        public ETaskStatus Status { get; set; }
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public bool IsRecurring { get; set; }
        public ERecurrenceType RecurrenceType { get; set; }
        public int RecurrenceInterval { get; set; }
        public DateTime? RecurrenceEndDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
