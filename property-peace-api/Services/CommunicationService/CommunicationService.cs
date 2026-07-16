using brownstone_hub_api.Dtos.Sms;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.SmsService;

namespace brownstone_hub_api.Services.CommunicationService
{
    public class CommunicationService : ICommunicationService
    {
        private readonly ISmsService _smsService;
        private readonly ILogger<CommunicationService> _logger;

        public CommunicationService(
            ISmsService smsService,
            ILogger<CommunicationService> logger)
        {
            _smsService = smsService;
            _logger = logger;
        }

        public async Task<ServiceResponse<SendSmsResponseDto>> SendSmsAsync(SendSmsDto request, CancellationToken cancellationToken = default)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.To))
                {
                    return ServiceResponse<SendSmsResponseDto>.CreateError(
                        "Recipient phone number is required",
                        "The 'To' field cannot be empty",
                        statusCode: 400
                    );
                }

                if (string.IsNullOrWhiteSpace(request.Message))
                {
                    return ServiceResponse<SendSmsResponseDto>.CreateError(
                        "Message content is required",
                        "The 'Message' field cannot be empty",
                        statusCode: 400
                    );
                }

                _logger.LogInformation("Sending SMS to {To}", request.To);

                var success = await _smsService.SendSmsAsync(request.To, request.Message, cancellationToken);

                if (success)
                {
                    return ServiceResponse<SendSmsResponseDto>.CreateSuccess(
                        new SendSmsResponseDto
                        {
                            Success = true
                        },
                        "SMS sent successfully"
                    );
                }
                else
                {
                    return ServiceResponse<SendSmsResponseDto>.CreateError(
                        "Failed to send SMS",
                        "The SMS could not be sent. Please check the phone number and try again.",
                        statusCode: 500
                    );
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending SMS to {To}", request.To);
                return ServiceResponse<SendSmsResponseDto>.CreateError(
                    "An error occurred while sending SMS",
                    ex.Message,
                    ex.InnerException?.Message ?? "",
                    statusCode: 500
                );
            }
        }

        public async Task<ServiceResponse<SendBulkSmsResponseDto>> SendBulkSmsAsync(SendBulkSmsDto request, CancellationToken cancellationToken = default)
        {
            try
            {
                if (request.To == null || request.To.Count == 0)
                {
                    return ServiceResponse<SendBulkSmsResponseDto>.CreateError(
                        "At least one recipient is required",
                        "The 'To' list cannot be empty",
                        statusCode: 400
                    );
                }

                if (string.IsNullOrWhiteSpace(request.Message))
                {
                    return ServiceResponse<SendBulkSmsResponseDto>.CreateError(
                        "Message content is required",
                        "The 'Message' field cannot be empty",
                        statusCode: 400
                    );
                }

                _logger.LogInformation("Sending bulk SMS to {Count} recipients", request.To.Count);

                var success = await _smsService.SendBulkSmsAsync(request.To, request.Message, cancellationToken);

                // Note: The current ISmsService.SendBulkSmsAsync returns a bool, not detailed results
                // We'll track success/failure counts if we enhance the service later
                if (success)
                {
                    return ServiceResponse<SendBulkSmsResponseDto>.CreateSuccess(
                        new SendBulkSmsResponseDto
                        {
                            TotalCount = request.To.Count,
                            SuccessCount = request.To.Count, // Approximate - actual count would require service enhancement
                            FailureCount = 0
                        },
                        "Bulk SMS sent successfully"
                    );
                }
                else
                {
                    return ServiceResponse<SendBulkSmsResponseDto>.CreateError(
                        "Failed to send bulk SMS",
                        "The bulk SMS could not be sent. Please check the phone numbers and try again.",
                        statusCode: 500
                    );
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending bulk SMS to {Count} recipients", request.To?.Count ?? 0);
                return ServiceResponse<SendBulkSmsResponseDto>.CreateError(
                    "An error occurred while sending bulk SMS",
                    ex.Message,
                    ex.InnerException?.Message ?? "",
                    statusCode: 500
                );
            }
        }
    }
}

