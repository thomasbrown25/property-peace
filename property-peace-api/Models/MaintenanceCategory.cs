
namespace brownstone_hub_api.Models
{
    public class MaintenanceCategory
    {
        public long Id { get; set; }
        public string Value { get; set; }
        public string Label { get; set; }
        public DateTime CreatedDate { get; set; } = DateTime.Now;

        public ICollection<MaintenanceRequest> MaintenanceRequests { get; set; }
    }
}