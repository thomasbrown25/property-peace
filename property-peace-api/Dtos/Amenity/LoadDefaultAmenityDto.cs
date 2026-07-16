using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Amenity
{
    public class LoadDefaultAmenityDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; }
    }
}
