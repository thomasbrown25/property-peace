using brownstone_hub_api.Config;
using brownstone_hub_api.Services;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace brownstone_hub_api.Services.SmsService
{
    public class TwilioSmsService : ISmsService
    {
        private readonly TwilioSettings _settings;
        private readonly ILogger<TwilioSmsService> _logger;
        private bool _isInitialized = false;

        public TwilioSmsService(
            IOptions<TwilioSettings> settings,
            ILogger<TwilioSmsService> logger)
        {
            _settings = settings.Value;
            _logger = logger;

            if (string.IsNullOrWhiteSpace(_settings.AccountSid) || string.IsNullOrWhiteSpace(_settings.AuthToken))
            {
                _logger.LogWarning("Twilio AccountSid or AuthToken is not configured. SMS sending will fail.");
            }
            else
            {
                TwilioClient.Init(_settings.AccountSid, _settings.AuthToken);
                _isInitialized = true;
                _logger.LogInformation("Twilio SMS service initialized successfully.");
            }

            if (string.IsNullOrWhiteSpace(_settings.FromPhoneNumber) && string.IsNullOrWhiteSpace(_settings.MessagingServiceSid))
            {
                _logger.LogWarning("Neither Twilio FromPhoneNumber nor MessagingServiceSid is configured. SMS sending will fail.");
            }
        }

        public async Task<bool> SendSmsAsync(string to, string message, CancellationToken cancellationToken = default, string? from = null) =>
            (await SubmitSmsAsync(to, message, cancellationToken, from)).Accepted;

        public async Task<SmsSubmissionResult> SubmitSmsAsync(string to, string message, CancellationToken cancellationToken = default,
            string? from = null, string? idempotencyToken = null)
        {
            var maskedTo = CommunicationLogSanitizer.MaskDestination(to);
            var configuredFrom = from ?? _settings.FromPhoneNumber;
            var maskedFrom = CommunicationLogSanitizer.MaskDestination(configuredFrom);
            try
            {
                if (!_isInitialized)
                {
                    _logger.LogError("Twilio SMS client is not initialized. Check Twilio configuration. AccountSid and AuthToken may be missing or invalid.");
                    return false;
                }

                var hasFrom = !string.IsNullOrWhiteSpace(from) || !string.IsNullOrWhiteSpace(_settings.FromPhoneNumber);
                var hasSid = !string.IsNullOrWhiteSpace(_settings.MessagingServiceSid);

                if (!hasFrom && !hasSid)
                {
                    _logger.LogError("Neither Twilio:FromPhoneNumber nor Twilio:MessagingServiceSid is configured.");
                    return false;
                }

                // Normalize phone number to E.164 format
                var normalizedTo = NormalizePhoneNumber(to);
                if (string.IsNullOrWhiteSpace(normalizedTo))
                {
                    _logger.LogError("Invalid phone number format: {PhoneNumber}", maskedTo);
                    return false;
                }

                if (string.IsNullOrWhiteSpace(message))
                {
                    _logger.LogError("SMS message cannot be empty.");
                    return false;
                }

                if (message.Length > 1600)
                {
                    _logger.LogWarning("SMS message exceeds 1600 characters. It will be truncated. Original length: {Length}", message.Length);
                    message = message.Substring(0, 1600);
                }

                var normalizedFrom = NormalizePhoneNumber(from ?? string.Empty);
                var useExplicitFrom = !string.IsNullOrWhiteSpace(normalizedFrom);
                var sourceDescription = useExplicitFrom
                    ? $"From:{CommunicationLogSanitizer.MaskDestination(normalizedFrom)}"
                    : hasSid
                        ? $"MessagingService:{_settings.MessagingServiceSid}"
                        : $"From:{CommunicationLogSanitizer.MaskDestination(_settings.FromPhoneNumber)}";

                _logger.LogInformation("Sending SMS via Twilio to {To} using {Source} with message length: {Length}",
                    maskedTo, sourceDescription, message.Length);

                var messageResource = useExplicitFrom
                    ? await MessageResource.CreateAsync(
                        from: new PhoneNumber(normalizedFrom),
                        to: new PhoneNumber(normalizedTo),
                        body: message)
                    : hasSid
                        ? await MessageResource.CreateAsync(
                            messagingServiceSid: _settings.MessagingServiceSid,
                            to: new PhoneNumber(normalizedTo),
                            body: message)
                        : await MessageResource.CreateAsync(
                            from: new PhoneNumber(_settings.FromPhoneNumber),
                            to: new PhoneNumber(normalizedTo),
                            body: message);

                if (messageResource.ErrorCode == null)
                {
                    _logger.LogInformation("SMS sent successfully via Twilio to {To} from {From}. MessageSid: {MessageSid}, Status: {Status}", 
                        maskedTo, maskedFrom, messageResource.Sid, messageResource.Status);
                    return new SmsSubmissionResult(true, "twilio", messageResource.Sid);
                }
                else
                {
                    _logger.LogError("Twilio SMS send failed for {To} from {From}. ErrorCode: {ErrorCode}; Status: {Status}",
                        maskedTo, maskedFrom, messageResource.ErrorCode, messageResource.Status);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError("Unexpected {ExceptionType} sending SMS via Twilio to {To} from {From}",
                    ex.GetType().Name, maskedTo, maskedFrom);
                return false;
            }
        }

        public async Task<bool> SendBulkSmsAsync(List<string> to, string message, CancellationToken cancellationToken = default, string? from = null)
        {
            try
            {
                if (!_isInitialized)
                {
                    _logger.LogError("Twilio SMS client is not initialized. Check Twilio configuration.");
                    return false;
                }

                var normalizedFrom = NormalizePhoneNumber(from ?? string.Empty);
                if (string.IsNullOrWhiteSpace(normalizedFrom))
                {
                    _logger.LogError("An explicit organization SMS sender is required for bulk sends.");
                    return false;
                }

                // Normalize all phone numbers
                var normalizedNumbers = to.Select(NormalizePhoneNumber)
                    .Where(phone => !string.IsNullOrWhiteSpace(phone))
                    .ToList();

                if (normalizedNumbers.Count == 0)
                {
                    _logger.LogError("No valid phone numbers provided for bulk SMS.");
                    return false;
                }

                if (normalizedNumbers.Count < to.Count)
                {
                    _logger.LogWarning("Some phone numbers were invalid. Sending to {ValidCount} of {TotalCount} recipients.", 
                        normalizedNumbers.Count, to.Count);
                }

                // Validate message length
                if (string.IsNullOrWhiteSpace(message))
                {
                    _logger.LogError("SMS message cannot be empty.");
                    return false;
                }

                if (message.Length > 1600)
                {
                    _logger.LogWarning("SMS message exceeds 1600 characters. It will be truncated.");
                    message = message.Substring(0, 1600);
                }

                _logger.LogInformation("Sending bulk SMS via Twilio to {Count} recipients from {From} with message length: {Length}", 
                    normalizedNumbers.Count, CommunicationLogSanitizer.MaskDestination(normalizedFrom), message.Length);

                // Send to each recipient
                var tasks = normalizedNumbers.Select(async phoneNumber =>
                {
                    try
                    {
                        var messageResource = await MessageResource.CreateAsync(
                            from: new PhoneNumber(normalizedFrom),
                            to: new PhoneNumber(phoneNumber),
                            body: message);
                        return new { PhoneNumber = phoneNumber, Success = messageResource.ErrorCode == null, MessageSid = messageResource.Sid, ErrorCode = messageResource.ErrorCode, ErrorMessage = messageResource.ErrorMessage };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("Unexpected {ExceptionType} sending SMS to {PhoneNumber} in bulk send",
                            ex.GetType().Name, CommunicationLogSanitizer.MaskDestination(phoneNumber));
                        return new { PhoneNumber = phoneNumber, Success = false, MessageSid = (string?)null, ErrorCode = (int?)null, ErrorMessage = ex.Message };
                    }
                });

                var results = await Task.WhenAll(tasks);
                var successCount = results.Count(r => r.Success);
                var failureCount = results.Length - successCount;

                if (successCount > 0)
                {
                    _logger.LogInformation("Bulk SMS via Twilio completed. Success: {SuccessCount}, Failed: {FailureCount}", 
                        successCount, failureCount);
                }

                if (failureCount > 0)
                {
                    var failedNumbers = results.Where(r => !r.Success).Select(r => r.PhoneNumber).ToList();
                    _logger.LogWarning("Failed to send SMS to {Count} recipients: {FailedNumbers}",
                        failureCount, string.Join(", ", failedNumbers.Select(CommunicationLogSanitizer.MaskDestination)));
                }

                // Return true if at least one message was sent successfully
                return successCount > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError("Unexpected {ExceptionType} sending bulk SMS via Twilio from {From}",
                    ex.GetType().Name, CommunicationLogSanitizer.MaskDestination(_settings.FromPhoneNumber));
                return false;
            }
        }

        /// <summary>
        /// Normalizes phone number to E.164 format (+1234567890)
        /// Handles various formats: (123) 456-7890, 123-456-7890, 1234567890, +11234567890
        /// </summary>
        private string NormalizePhoneNumber(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
                return string.Empty;

            // Remove all non-digit characters except +
            var cleaned = Regex.Replace(phoneNumber, @"[^\d+]", "");

            // If it starts with +, assume it's already in E.164 format
            if (cleaned.StartsWith("+"))
            {
                return cleaned;
            }

            // If it's 10 digits, assume US number and add +1
            if (cleaned.Length == 10)
            {
                return $"+1{cleaned}";
            }

            // If it's 11 digits and starts with 1, add +
            if (cleaned.Length == 11 && cleaned.StartsWith("1"))
            {
                return $"+{cleaned}";
            }

            // If it's already 11+ digits with country code, add +
            if (cleaned.Length >= 11)
            {
                return $"+{cleaned}";
            }

            // Return as-is if we can't determine format (will likely fail validation)
            _logger.LogWarning("Unable to normalize phone number: {PhoneNumber}. Returning normalized digits as-is.",
                CommunicationLogSanitizer.MaskDestination(phoneNumber));
            return cleaned;
        }
    }
}
