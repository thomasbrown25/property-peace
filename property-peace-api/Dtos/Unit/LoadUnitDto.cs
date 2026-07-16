using brownstone_hub_api.Dtos.Amenity;
using brownstone_hub_api.Dtos.IncludedUtility;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Dtos.Unit
{
    public class LoadUnitDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public string Bedrooms { get; set; } = "";
        public string Baths { get; set; } = "";
        public string Type { get; set; } = "";
        public int SquareFeet { get; set; }
        public long PropertyId { get; set; }
        public decimal RentAmount { get; set; } = 0;
        public bool IsOccupied { get; set; } = false;
        public string Status { get; set; } = "vacant";

        public List<AmenityDto> Amenities { get; set; } = [];
        public List<IncludedUtilityDto> IncludedUtility { get; set; } = [];
        public LoadLeaseDto? Lease { get; set; }
        public ICollection<LoadTenantDto> Tenants { get; set; } = [];
        public ICollection<LoadMaintenanceRequestDto> MaintenanceRequests { get; set; } = [];
    }
}