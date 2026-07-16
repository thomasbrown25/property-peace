using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Amenity
{
    public class CreateCustomAmenityDto
    {
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; } // PropertyAmenity or PropertyFeature
    }
}
