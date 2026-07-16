using Azure;
using Azure.Communication.Sms;
using brownstone_hub_api.Config;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.SmsService
{
    public class AzureCommunicationSmsService : ISmsService
    {
        private readonly SmsClient? _smsClient;
        private readonly AzureCommunicationSettings _settings;
        private readonly ILogger<AzureCommunicationSmsService> _logger;

        public AzureCommunicationSmsService(
            IOptions<AzureCommunicationSettings> settings,
            ILogger<AzureCommunicationSmsService> logger)
        {
            _settings = settings.Value;
            _logger = logger;

            if (string.IsNullOrWhiteSpace(_settings.ConnectionString))
            {
                _logger.LogWarning("Azure Communication Services connection string is not configured. SMS sending will fail.");
            }
            else
            {
                _smsClient = new SmsClient(_settings.ConnectionString);
            }

            if (string.IsNullOrWhiteSpace(_settings.SmsFromPhoneNumber))
            {
                _logger.LogWarning("SMS from phone number is not configured. SMS sending will fail.");
            }
        }

        public async Task<bool> SendSmsAsync(string to, string message, CancellationToken cancellationToken = default, string? from = null)
        {
            try
            {
                if (_smsClient == null)
                {
                    _logger.LogError("SMS client is not initialized. Check Azure Communication Services configuration. Connection string may be missing or invalid.");
                    return false;
                }

                if (string.IsNullOrWhiteSpace(_settings.SmsFromPhoneNumber))
                {
                    _logger.LogError("SMS from phone number is not configured in AzureCommunicationSettings. Please set AzureCommunication:SmsFromPhoneNumber in Azure App Configuration.");
                    return false;
                }

                // Normalize phone number to E.164 format
                var normalizedTo = NormalizePhoneNumber(to);
                if (string.IsNullOrWhiteSpace(normalizedTo))
                {
                    _logger.LogError("Invalid phone number format: {PhoneNumber}. Expected format: +1234567890 or (123) 456-7890", to);
                    return false;
                }

                // Validate message length (SMS has 160 character limit per message, but ACS supports longer messages that will be split)
                if (string.IsNullOrWhiteSpace(message))
                {
                    _logger.LogError("SMS message cannot be empty.");
                    return false;
                }

                if (message.Length > 2048)
                {
                    _logger.LogWarning("SMS message exceeds 2048 characters. It will be truncated. Original length: {Length}", message.Length);
                    message = message.Substring(0, 2048);
                }

                _logger.LogInformation("Sending SMS to {To} from {From} with message length: {Length}", normalizedTo, _settings.SmsFromPhoneNumber, message.Length);

                SmsSendResult sendResult = await _smsClient.SendAsync(
                    from: _settings.SmsFromPhoneNumber,
                    to: normalizedTo,
                    message: message,
                    cancellationToken: cancellationToken);

                if (sendResult.Successful)
                {
                    _logger.LogInformation("SMS sent successfully to {To} from {From}. MessageId: {MessageId}", 
                        normalizedTo, _settings.SmsFromPhoneNumber, sendResult.MessageId);
                    return true;
                }
                else
                {
                    _logger.LogError("SMS send failed for {To} from {From}. Error: {Error}", 
                        normalizedTo, _settings.SmsFromPhoneNumber, sendResult.ErrorMessage);
                    return false;
                }
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure Communication Services error sending SMS to {To} from {From}: {Error}. " +
                    "Ensure the phone number '{FromNumber}' is configured in Azure Communication Services.",
                    to, _settings.SmsFromPhoneNumber, ex.Message, _settings.SmsFromPhoneNumber);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending SMS to {To} from {From}: {Error}", 
                    to, _settings.SmsFromPhoneNumber, ex.Message);
                return false;
            }
        }

        public async Task<bool> SendBulkSmsAsync(List<string> to, string message, CancellationToken cancellationToken = default)
        {
            try
            {
                if (_smsClient == null)
                {
                    _logger.LogError("SMS client is not initialized. Check Azure Communication Services configuration.");
                    return false;
                }

                if (string.IsNullOrWhiteSpace(_settings.SmsFromPhoneNumber))
                {
                    _logger.LogError("SMS from phone number is not configured in AzureCommunicationSettings.");
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

                if (message.Length > 2048)
                {
                    _logger.LogWarning("SMS message exceeds 2048 characters. It will be truncated.");
                    message = message.Substring(0, 2048);
                }

                _logger.LogInformation("Sending bulk SMS to {Count} recipients from {From} with message length: {Length}", 
                    normalizedNumbers.Count, _settings.SmsFromPhoneNumber, message.Length);

                // Send to each recipient (ACS SMS doesn't have a true bulk send, so we send individually)
                var results = new List<SmsSendResult>();
                foreach (var phoneNumber in normalizedNumbers)
                {
                    try
                    {
                        var sendResult = await _smsClient.SendAsync(
                            from: _settings.SmsFromPhoneNumber,
                            to: phoneNumber,
                            message: message,
                            cancellationToken: cancellationToken);
                        results.Add(sendResult);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error sending SMS to {PhoneNumber} in bulk send: {Error}", phoneNumber, ex.Message);
                    }
                }

                var successCount = results.Count(r => r.Successful);
                var failureCount = results.Count - successCount;

                if (successCount > 0)
                {
                    _logger.LogInformation("Bulk SMS completed. Success: {SuccessCount}, Failed: {FailureCount}", 
                        successCount, failureCount);
                }

                // Return true if at least one message was sent successfully
                return successCount > 0;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Azure Communication Services error sending bulk SMS from {From}: {Error}. " +
                    "Ensure the phone number '{FromNumber}' is configured in Azure Communication Services.",
                    _settings.SmsFromPhoneNumber, ex.Message, _settings.SmsFromPhoneNumber);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending bulk SMS from {From}: {Error}", 
                    _settings.SmsFromPhoneNumber, ex.Message);
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
            _logger.LogWarning("Unable to normalize phone number: {PhoneNumber}. Returning as-is.", phoneNumber);
            return cleaned;
        }
    }
}

