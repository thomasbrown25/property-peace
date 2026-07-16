
using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Dtos.Household
{
    public class LoadHouseholdDto
    {
        public long LeaseId { get; set; }
        public string PropertyName { get; set; }
        public string PropertyType { get; set; }
        public string UnitName { get; set; }
        public DateTime? LeaseStartDate { get; set; }
        public DateTime? LeaseEndDate { get; set; }
        public decimal BalanceDue { get; set; }
        public List<LoadTenantDto> Tenants { get; set; } = [];
    }
}