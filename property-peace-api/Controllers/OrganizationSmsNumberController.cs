using brownstone_hub_api.Dtos.OrganizationSmsNumber;
using brownstone_hub_api.Services.OrganizationSmsNumberService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/organization-sms-number")]
    [Authorize(Roles = "Landlord,Admin")]
    public class OrganizationSmsNumberController : ControllerBase
    {
        private readonly IOrganizationSmsNumberService _organizationSmsNumberService;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<OrganizationSmsNumberController> _logger;

        public OrganizationSmsNumberController(
            IOrganizationSmsNumberService organizationSmsNumberService,
            IWebHostEnvironment environment,
            ILogger<OrganizationSmsNumberController> logger)
        {
            _organizationSmsNumberService = organizationSmsNumberService;
            _environment = environment;
            _logger = logger;
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var status = await _organizationSmsNumberService.GetStatusAsync();
            return Ok(new ServiceResponse<OrganizationSmsNumberStatusDto> { Data = status });
        }

        [HttpGet("area-codes")]
        public async Task<IActionResult> GetAreaCodes([FromQuery] string state)
        {
            var codes = await _organizationSmsNumberService.GetAreaCodesAsync(state);
            return Ok(new ServiceResponse<List<SmsAreaCodeDto>> { Data = codes });
        }

        [HttpGet("available")]
        public async Task<IActionResult> SearchAvailable([FromQuery] string state, [FromQuery] string areaCode, CancellationToken cancellationToken)
        {
            try
            {
                var numbers = await _organizationSmsNumberService.SearchAsync(new SearchSmsNumbersRequestDto
                {
                    State = state,
                    AreaCode = areaCode
                }, cancellationToken);

                return Ok(new ServiceResponse<List<AvailableSmsNumberDto>> { Data = numbers });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new ServiceResponse<List<AvailableSmsNumberDto>> { Success = false, Message = ex.Message, StatusCode = 403 });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ServiceResponse<List<AvailableSmsNumberDto>> { Success = false, Message = ex.Message, StatusCode = 400 });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Twilio SMS number search is not available for state {State}, area code {AreaCode}", state, areaCode);
                return StatusCode(502, new ServiceResponse<List<AvailableSmsNumberDto>> { Success = false, Message = ex.Message, StatusCode = 502 });
            }
            catch (TwilioApiOperationException ex)
            {
                _logger.LogError(ex, "Twilio SMS number search failed for state {State}, area code {AreaCode}", state, areaCode);
                return StatusCode(502, CreateTwilioErrorResponse<List<AvailableSmsNumberDto>>("Unable to search available SMS numbers right now.", ex, 502));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching Twilio SMS numbers for state {State}, area code {AreaCode}", state, areaCode);
                return StatusCode(500, new ServiceResponse<List<AvailableSmsNumberDto>> { Success = false, Message = "Unable to search available SMS numbers right now.", StatusCode = 500 });
            }
        }

        [HttpPost("purchase")]
        public async Task<IActionResult> Purchase([FromBody] PurchaseSmsNumberDto request, CancellationToken cancellationToken)
        {
            try
            {
                var smsWebhookUrl = $"{Request.Scheme}://{Request.Host}/api/webhook/twilio/inbound-sms";
                var status = await _organizationSmsNumberService.PurchaseAsync(request, smsWebhookUrl, cancellationToken);
                return Ok(new ServiceResponse<OrganizationSmsNumberStatusDto> { Data = status, Message = "Dedicated SMS number purchased and assigned." });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new ServiceResponse<OrganizationSmsNumberStatusDto> { Success = false, Message = ex.Message, StatusCode = 403 });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ServiceResponse<OrganizationSmsNumberStatusDto> { Success = false, Message = ex.Message, StatusCode = 400 });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ServiceResponse<OrganizationSmsNumberStatusDto> { Success = false, Message = ex.Message, StatusCode = 400 });
            }
            catch (TwilioApiOperationException ex)
            {
                _logger.LogError(ex, "Twilio SMS number purchase failed for {PhoneNumber}", request.PhoneNumber);
                return StatusCode(502, CreateTwilioErrorResponse<OrganizationSmsNumberStatusDto>("Unable to purchase this SMS number right now.", ex, 502));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error purchasing dedicated SMS number {PhoneNumber}", request.PhoneNumber);
                return StatusCode(500, CreateLocalErrorResponse<OrganizationSmsNumberStatusDto>("Unable to purchase this SMS number right now.", ex, 500));
            }
        }

        [HttpGet("{id:long}/purchase-status")]
        public async Task<IActionResult> GetPurchaseStatus(long id, CancellationToken cancellationToken)
        {
            try
            {
                var status = await _organizationSmsNumberService.RefreshStatusAsync(id, cancellationToken);
                return Ok(new ServiceResponse<OrganizationSmsNumberStatusDto> { Data = status });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new ServiceResponse<OrganizationSmsNumberStatusDto> { Success = false, Message = ex.Message, StatusCode = 404 });
            }
            catch (TwilioApiOperationException ex)
            {
                _logger.LogError(ex, "Twilio phone number purchase-status refresh failed for {Id}", id);
                return StatusCode(502, CreateTwilioErrorResponse<OrganizationSmsNumberStatusDto>("Unable to refresh SMS number status right now.", ex, 502));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing Twilio phone number purchase status for {Id}", id);
                return StatusCode(500, CreateLocalErrorResponse<OrganizationSmsNumberStatusDto>("Unable to refresh SMS number status right now.", ex, 500));
            }
        }
        private ServiceResponse<T> CreateLocalErrorResponse<T>(string userMessage, Exception exception, int statusCode)
        {
            var includeLocalDiagnostics = _environment.IsDevelopment();
            var response = new ServiceResponse<T>
            {
                Success = false,
                Message = includeLocalDiagnostics
                    ? $"{userMessage} Error details are included in the errors object when running locally."
                    : userMessage,
                StatusCode = statusCode
            };

            if (includeLocalDiagnostics)
            {
                response.Errors = new Error
                {
                    Message = exception.Message,
                    Details = exception.ToString(),
                    InnerException = exception.InnerException?.Message
                };
            }

            return response;
        }

        private ServiceResponse<T> CreateTwilioErrorResponse<T>(string userMessage, TwilioApiOperationException exception, int statusCode)
        {
            var includeLocalDiagnostics = _environment.IsDevelopment();
            var response = new ServiceResponse<T>
            {
                Success = false,
                Message = includeLocalDiagnostics
                    ? $"{userMessage} Error details are included in the errors object when running locally."
                    : userMessage,
                StatusCode = statusCode
            };

            if (includeLocalDiagnostics)
            {
                response.Errors = new Error
                {
                    Message = exception.Message,
                    Details = $"Operation: {exception.Operation}; TwilioStatus: {exception.TwilioStatus}; TwilioCode: {exception.TwilioCode}; MoreInfo: {exception.MoreInfo}",
                    InnerException = exception.InnerException?.Message
                };
            }

            return response;
        }
    }
}