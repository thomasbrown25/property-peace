
using brownstone_hub_api.Dtos.Household;

namespace brownstone_hub_api.Services.HouseholdService
{
    public interface IHouseholdService
    {
        Task<ServiceResponse<List<LoadHouseholdDto>>> GetHouseholdsByLandlordId(long landlordId);
    }
}