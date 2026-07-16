using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceImage;
using brownstone_hub_api.Dtos.Unit;

namespace brownstone_hub_api.Dtos.MaintenanceRequest
{
    public class LoadMaintenanceRequestDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; }
        public string PropertyType { get; set; }
        public long? UnitId { get; set; }
        public string UnitName { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string? OrderNumber { get; set; }
        public EMaintenanceStatus Status { get; set; }
        public EMaintenancePriority Priority { get; set; }
        public long CategoryId { get; set; }
        public LoadMaintenanceCategoryDto Category { get; set; }

        public List<LoadImageDto> Images { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public long? ConversationId { get; set; }
        public long? VendorId { get; set; }
        public string? VendorName { get; set; }
        public string? VendorEmail { get; set; }
        public string? VendorPhone { get; set; }
        public string? PropertyImageUrl { get; set; }

        // Assignment
        public EAssignedToType AssignedToType { get; set; }
        public long? AssignedToUserId { get; set; }
        public string? AssignedContactName { get; set; }
        public string? AssignedContactPhone { get; set; }
        public string? AssignedContactEmail { get; set; }
        public DateTime? AssignedAt { get; set; }
    }


}