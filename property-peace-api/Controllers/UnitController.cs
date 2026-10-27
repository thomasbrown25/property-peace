using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Attributes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class UnitController(IUnitService unitService, RentalModeService rentalModeService) : ControllerBase
    {
        private readonly IUnitService _unitService = unitService;

        [RequireOrganizationRole("Owner", "Manager")]
        [HttpGet("{unitId:long}/rental-mode/preflight")]
        public async Task<IActionResult> RentalModePreflight(long unitId, [FromQuery] ERentalMode targetMode, CancellationToken cancellationToken)
        {
            var response = await rentalModeService.Preflight(unitId, targetMode, cancellationToken);
            return StatusCode(response.StatusCode, response);
        }

        [RequireOrganizationRole("Owner", "Manager")]
        [HttpPost("{unitId:long}/rental-mode")]
        public async Task<IActionResult> ChangeRentalMode(long unitId, [FromBody] ChangeRentalModeRequest request, CancellationToken cancellationToken)
        {
            var response = await rentalModeService.Change(unitId, request, cancellationToken);
            return StatusCode(response.StatusCode, response);
        }

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
        public async Task<IActionResult> AddOrUpdateUnit([FromBody] UpdateUnitDto updatedUnit, CancellationToken cancellationToken)
        {
            var response = await _unitService.AddOrUpdateUnit(updatedUnit, cancellationToken);

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
        public async Task<IActionResult> BulkCreateUnits([FromBody] BulkCreateUnitsDto bulkCreateDto, CancellationToken cancellationToken)
        {
            var response = await _unitService.BulkCreateUnits(bulkCreateDto, cancellationToken);

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