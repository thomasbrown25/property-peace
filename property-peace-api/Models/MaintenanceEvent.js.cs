using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace brownstone_hub_api.Models
{
    public class MaintenanceEvent
    {
        public long Id { get; set; }
        public long MaintenanceId { get; set; }
        public MaintenanceRequest Maintenance { get; set; } = default!;

        public MaintenanceEventType EventType { get; set; }

        // For simple value deltas; you can JSON this if needed
        public string? FromValue { get; set; }
        public string? ToValue { get; set; }

        public Guid? ChangedByUserId { get; set; }   // or int, string—whatever your users are
        public string? Note { get; set; }

        public DateTimeOffset ChangedAt { get; set; }
    }

    public enum MaintenanceEventType
    {
        StatusChanged,
        PriorityChanged,
        TitleChanged,
        NoteAdded,
    }
}