using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Services.UnitService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class UnitController(IUnitService unitService) : ControllerBase
    {
        private readonly IUnitService _unitService = unitService;

        [Authorize]
        [HttpGet("{propertyId}")]
        public async Task<IActionResult> GetUnits(long propertyId)
        {
            var response = await _unitService.GetUnits(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPost("")]
        public async Task<IActionResult> AddOrUpdateUnit([FromBody] UpdateUnitDto updatedUnit)
        {
            var response = await _unitService.AddOrUpdateUnit(updatedUnit);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPost("bulk")]
        public async Task<IActionResult> BulkCreateUnits([FromBody] BulkCreateUnitsDto bulkCreateDto)
        {
            var response = await _unitService.BulkCreateUnits(bulkCreateDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUnit(long id)
        {
            var response = await _unitService.DeleteUnit(id);

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