
namespace brownstone_hub_api.Dtos.MaintenanceEvent
{
    public class MaintenanceEventDto
    {
        public long Id { get; init; }
        public long MaintenanceId { get; init; }

        public MaintenanceEventType EventType { get; init; }

        public string? FromValue { get; init; }
        public string? ToValue { get; init; }

        public Guid? ChangedByUserId { get; init; }
        public string? ChangedByUserName { get; init; }

        public string? Note { get; init; }

        public DateTimeOffset ChangedAt { get; init; }
    }
}