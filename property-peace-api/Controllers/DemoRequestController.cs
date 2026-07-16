using brownstone_hub_api.Dtos.DemoRequest;
using brownstone_hub_api.Services.DemoRequestService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/demo-requests")]
    public class DemoRequestController(IDemoRequestService demoRequestService) : ControllerBase
    {
        private readonly IDemoRequestService _demoRequestService = demoRequestService;

        /// <summary>
        /// Create a new demo request (public endpoint - no authorization required)
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> AddDemoRequest([FromBody] AddDemoRequestDto demoRequest)
        {
            var response = await _demoRequestService.AddDemoRequest(demoRequest);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return StatusCode(201, response);
        }

        /// <summary>
        /// Get a demo request by ID (Admin only)
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetDemoRequestById(long id)
        {
            var response = await _demoRequestService.GetDemoRequestById(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        /// <summary>
        /// Get all demo requests (Admin only)
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAllDemoRequests([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            ServiceResponse<List<LoadDemoRequestDto>> response;

            if (startDate.HasValue || endDate.HasValue)
            {
                response = await _demoRequestService.GetDemoRequestsByDateRange(startDate, endDate);
            }
            else
            {
                response = await _demoRequestService.GetAllDemoRequests();
            }

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
