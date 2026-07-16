
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.ClientStatement;
using brownstone_hub_api.Services.ClientStatementService;
using brownstone_hub_api.Helpers;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin,Owner")]
    public class ClientStatementController : ControllerBase
    {
        private readonly IClientStatementService _clientStatementService;
        private readonly ILogger<ClientStatementController> _logger;

        public ClientStatementController(
            IClientStatementService clientStatementService,
            ILogger<ClientStatementController> logger)
        {
            _clientStatementService = clientStatementService;
            _logger = logger;
        }

        [HttpGet("{clientId}")]
        public async Task<IActionResult> GetClientStatements(long clientId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                // Authorization check: ensure clientId matches current user's clientId if role is "Owner"
                var currentUserRole = User?.FindFirst(ClaimTypes.Role)?.Value;

                if (currentUserRole == "Owner")
                {
                    // TODO: Implement robust client-to-user mapping check
                    // Need to verify that the clientId corresponds to the current user's linked ClientId
                }

                var response = await _clientStatementService.GetClientStatements(clientId, startDate, endDate);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client statements for client {ClientId}", clientId);
                return StatusCode(500, new { message = "An error occurred while retrieving client statements" });
            }
        }

        [HttpGet("{clientId}/property/{propertyId}")]
        public async Task<IActionResult> GetClientStatementForProperty(
            long clientId, 
            long propertyId, 
            [FromQuery] DateTime? startDate = null, 
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                // Authorization check similar to GetClientStatements
                var start = startDate ?? DateTime.Now.AddMonths(-1).Date;
                var end = endDate ?? DateTime.Now.Date;

                var response = await _clientStatementService.GenerateClientStatement(clientId, propertyId, start, end);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating client statement for client {ClientId}, property {PropertyId}", clientId, propertyId);
                return StatusCode(500, new { message = "An error occurred while generating the client statement" });
            }
        }

        [HttpPost("generate")]
        [Authorize(Roles = "Landlord,Admin")] // Only PM can generate
        public async Task<IActionResult> GenerateClientStatement([FromBody] GenerateClientStatementRequestDto request)
        {
            try
            {
                if (!request.PropertyId.HasValue)
                {
                    return BadRequest(new { message = "PropertyId is required for generating client statements" });
                }

                var response = await _clientStatementService.GenerateClientStatement(
                    request.ClientId, 
                    request.PropertyId.Value, 
                    request.StartDate, 
                    request.EndDate);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating client statement");
                return StatusCode(500, new { message = "An error occurred while generating the client statement" });
            }
        }

        [HttpGet("{clientId}/summary")]
        public async Task<IActionResult> GetClientFinancialSummary(
            long clientId, 
            [FromQuery] DateTime? startDate = null, 
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                // Authorization check similar to GetClientStatements
                var response = await _clientStatementService.GetClientFinancialSummary(clientId, startDate, endDate);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client financial summary for client {ClientId}", clientId);
                return StatusCode(500, new { message = "An error occurred while retrieving the client financial summary" });
            }
        }
    }
}
