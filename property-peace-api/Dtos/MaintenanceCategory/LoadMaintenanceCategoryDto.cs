

namespace brownstone_hub_api.Dtos.MaintenanceCategory
{
    public class LoadMaintenanceCategoryDto
    {
        public long Id { get; set; }
        public string Value { get; set; }
        public string Label { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.Now;

    }
}