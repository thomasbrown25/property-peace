namespace brownstone_hub_api.Dtos.MaintenanceRequest
{
    public class AddMaintenanceRequestDto
    {
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public string? Title { get; set; } // Made nullable - AI will generate if not provided
        public string Description { get; set; } = string.Empty;
        public long? CategoryId { get; set; } // Made nullable - AI will generate if not provided
        public EMaintenanceStatus Status { get; set; } = EMaintenanceStatus.Reported;
        public EMaintenancePriority Priority { get; set; } = EMaintenancePriority.Medium;
        public long? OrganizationId { get; set; } // Organization that owns this maintenance request
        public DateTime? ScheduledDate { get; set; }
    }
}