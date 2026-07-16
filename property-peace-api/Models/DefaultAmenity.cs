using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class DefaultAmenity
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public EAmenityCategory Category { get; set; } // PropertyAmenity or PropertyFeature
    }
}
