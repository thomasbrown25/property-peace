using brownstone_hub_api.Dtos.Household;
using brownstone_hub_api.Services.HouseholdService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class HouseholdController(IHouseholdService householdService) : ControllerBase
    {
        private readonly IHouseholdService _householdService = householdService;

        [Authorize]
        [HttpGet("landlord/{landlordId}")]
        public async Task<ActionResult<ServiceResponse<List<LoadHouseholdDto>>>> GetHouseholdsByLandlordId(long landlordId)
        {
            var response = await _householdService.GetHouseholdsByLandlordId(landlordId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }


    }
}