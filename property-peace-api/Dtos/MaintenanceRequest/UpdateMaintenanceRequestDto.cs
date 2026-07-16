namespace brownstone_hub_api.Dtos.MaintenanceRequest
{
    public class UpdateMaintenanceRequestDto
    {
        public long Id { get; set; }
        public string Title { get; set; }
        public string UnitName { get; set; }
        public EMaintenanceStatus Status { get; set; }
        public EMaintenancePriority Priority { get; set; }
        public string Description { get; set; }
        public long CategoryId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public long? VendorId { get; set; }

        // Assignment
        public EAssignedToType AssignedToType { get; set; }
        public long? AssignedToUserId { get; set; }
        public string? AssignedContactName { get; set; }
        public string? AssignedContactPhone { get; set; }
        public string? AssignedContactEmail { get; set; }
        public DateTime? AssignedAt { get; set; }
        public long? AssignedByUserId { get; set; }
    }
}