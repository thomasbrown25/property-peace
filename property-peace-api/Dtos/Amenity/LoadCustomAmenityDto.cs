using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Amenity
{
    public class LoadCustomAmenityDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; }
        public long OrganizationId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
