using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Models;
using brownstone_hub_api.Dtos.SupportRequest;
using brownstone_hub_api.Services.SupportRequestService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/support")]
    [Authorize]
    public class SupportRequestController : ControllerBase
    {
        private readonly ISupportRequestService _supportRequestService;
        private readonly ILogger<SupportRequestController> _logger;

        public SupportRequestController(
            ISupportRequestService supportRequestService,
            ILogger<SupportRequestController> logger)
        {
            _supportRequestService = supportRequestService;
            _logger = logger;
        }

        [HttpPost("submit-request")]
        public async Task<IActionResult> SubmitRequest([FromBody] SubmitSupportRequestDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Type) ||
                    string.IsNullOrWhiteSpace(request.Subject) ||
                    string.IsNullOrWhiteSpace(request.Message))
                {
                    return BadRequest(new { message = "Type, subject, and message are required" });
                }

                if (request.Type != "tech-support" && request.Type != "feedback")
                {
                    return BadRequest(new { message = "Type must be either 'tech-support' or 'feedback'" });
                }

                var response = await _supportRequestService.SubmitSupportRequest(request);

                if (!response.Success)
                {
                    var statusCode = response.StatusCode > 0 ? response.StatusCode : 500;
                    return StatusCode(statusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting support request: {Message}", ex.Message);
                _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
                if (ex.InnerException != null)
                {
                    _logger.LogError(ex.InnerException, "Inner exception: {Message}", ex.InnerException.Message);
                }

                // Ensure CORS headers are added to error response
                var origin = Request.Headers["Origin"].ToString();
                if (!string.IsNullOrEmpty(origin) && !Response.Headers.ContainsKey("Access-Control-Allow-Origin"))
                {
                    Response.Headers.Append("Access-Control-Allow-Origin", origin);
                    Response.Headers.Append("Access-Control-Allow-Credentials", "true");
                }

                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "An error occurred while submitting the support request",
                    ex.Message,
                    ex.InnerException?.Message,
                    500));
            }
        }
    }
}

