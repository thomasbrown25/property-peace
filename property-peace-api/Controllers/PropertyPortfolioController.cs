using brownstone_hub_api.Dtos.PropertyPortfolio;
using brownstone_hub_api.Services.PropertyPortfolioService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class PropertyPortfolioController(
        IPropertyPortfolioService propertyPortfolioService) : ControllerBase
    {
        private readonly IPropertyPortfolioService _propertyPortfolioService = propertyPortfolioService;

        [HttpGet("{landlordId}/analytics")]
        public async Task<IActionResult> GetAnalytics(long landlordId, [FromQuery] long? propertyId = null, [FromQuery] string timeRange = "12months")
        {
            try
            {
                var response = await _propertyPortfolioService.GetPropertyPortfolioAnalytics(landlordId, propertyId, timeRange);
                
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error retrieving property portfolio analytics", Error = ex.Message });
            }
        }

        [HttpGet("{landlordId}/occupancy")]
        public async Task<IActionResult> GetOccupancy(long landlordId, [FromQuery] long? propertyId = null)
        {
            try
            {
                var response = await _propertyPortfolioService.GetPropertyOccupancyData(landlordId, propertyId);
                
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error retrieving property occupancy data", Error = ex.Message });
            }
        }

        [HttpGet("{landlordId}/calendar")]
        public async Task<IActionResult> GetUnitAvailabilityCalendar(long landlordId, [FromQuery] long? propertyId = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var response = await _propertyPortfolioService.GetUnitAvailabilityCalendar(landlordId, propertyId, startDate, endDate);
                
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error retrieving unit availability calendar", Error = ex.Message });
            }
        }
    }
}

