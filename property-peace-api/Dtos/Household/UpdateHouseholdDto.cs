

using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Dtos.Household
{
    public class UpdateHouseholdDto
    {
        public long LeaseId { get; set; }
        public DateTime LeaseStartDate { get; set; }
        public DateTime LeaseEndDate { get; set; }
        public decimal RentAmount { get; set; }
        public decimal SecurityDeposit { get; set; }
        public bool IsActive { get; set; }
        public List<AddTenantDto> Tenants { get; set; }
    }
}