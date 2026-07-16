using brownstone_hub_api.Dtos.Sms;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.CommunicationService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class CommunicationController : ControllerBase
    {
        private readonly ICommunicationService _communicationService;
        private readonly ILogger<CommunicationController> _logger;

        public CommunicationController(
            ICommunicationService communicationService,
            ILogger<CommunicationController> logger)
        {
            _communicationService = communicationService;
            _logger = logger;
        }

        /// <summary>
        /// Send an SMS message to a single recipient
        /// </summary>
        /// <param name="request">SMS request containing recipient phone number and message</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns>Response indicating success or failure</returns>
        [HttpPost("sms/send")]
        public async Task<ActionResult<ServiceResponse<SendSmsResponseDto>>> SendSms(
            [FromBody] SendSmsDto request,
            CancellationToken cancellationToken = default)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ServiceResponse<SendSmsResponseDto>
                {
                    Success = false,
                    Message = "Invalid request",
                    StatusCode = 400,
                    Errors = new Error
                    {
                        Message = "Validation failed",
                        Details = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage))
                    }
                });
            }

            var response = await _communicationService.SendSmsAsync(request, cancellationToken);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, response);
            }

            return Ok(response);
        }

        /// <summary>
        /// Send an SMS message to multiple recipients
        /// </summary>
        /// <param name="request">Bulk SMS request containing recipient phone numbers and message</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns>Response indicating success or failure with counts</returns>
        [HttpPost("sms/send-bulk")]
        public async Task<ActionResult<ServiceResponse<SendBulkSmsResponseDto>>> SendBulkSms(
            [FromBody] SendBulkSmsDto request,
            CancellationToken cancellationToken = default)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ServiceResponse<SendBulkSmsResponseDto>
                {
                    Success = false,
                    Message = "Invalid request",
                    StatusCode = 400,
                    Errors = new Error
                    {
                        Message = "Validation failed",
                        Details = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage))
                    }
                });
            }

            var response = await _communicationService.SendBulkSmsAsync(request, cancellationToken);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, response);
            }

            return Ok(response);
        }
    }
}

