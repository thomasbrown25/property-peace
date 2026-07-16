using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.OrganizationSmsNumber;
using Microsoft.Extensions.Options;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Rest.Api.V2010.Account.AvailablePhoneNumberCountry;
using Twilio.Exceptions;
using Twilio.Types;
using MessagingServicePhoneNumberResource = Twilio.Rest.Messaging.V1.Service.PhoneNumberResource;

namespace brownstone_hub_api.Services.OrganizationSmsNumberService
{
    public interface ITwilioPhoneNumberService
    {
        Task<List<AvailableSmsNumberDto>> SearchLocalNumbersAsync(string state, string areaCode, CancellationToken cancellationToken = default);
        Task<(string Sid, string PhoneNumber, string FriendlyName, string Status)> PurchaseNumberAsync(string phoneNumber, string smsWebhookUrl, string? friendlyName = null, CancellationToken cancellationToken = default);
        Task<string?> GetPhoneNumberStatusAsync(string twilioPhoneNumberSid, CancellationToken cancellationToken = default);
    }

    public class TwilioPhoneNumberService : ITwilioPhoneNumberService
    {
        private readonly TwilioSettings _settings;
        private readonly ILogger<TwilioPhoneNumberService> _logger;
        private readonly bool _isConfigured;

        public TwilioPhoneNumberService(IOptions<TwilioSettings> settings, ILogger<TwilioPhoneNumberService> logger)
        {
            _settings = settings.Value;
            _logger = logger;
            _isConfigured = !string.IsNullOrWhiteSpace(_settings.AccountSid) && !string.IsNullOrWhiteSpace(_settings.AuthToken);
            if (_isConfigured)
            {
                TwilioClient.Init(_settings.AccountSid, _settings.AuthToken);
            }
        }

        public async Task<List<AvailableSmsNumberDto>> SearchLocalNumbersAsync(string state, string areaCode, CancellationToken cancellationToken = default)
        {
            if (!_isConfigured)
            {
                throw new InvalidOperationException("Twilio AccountSid/AuthToken are not configured.");
            }

            if (!IsValidAreaCode(areaCode))
            {
                throw new ArgumentException("Area code must be exactly 3 digits.", nameof(areaCode));
            }

            try
            {
                var options = new ReadLocalOptions("US")
                {
                    AreaCode = int.Parse(areaCode),
                    InRegion = state?.Trim().ToUpperInvariant(),
                    SmsEnabled = true,
                    ExcludeAllAddressRequired = true,
                    Limit = 12
                };

                var numbers = await LocalResource.ReadAsync(options);

                return numbers
                    .Where(n => n.Capabilities?.Sms == true)
                    .Select(n => new AvailableSmsNumberDto
                    {
                        PhoneNumber = n.PhoneNumber?.ToString() ?? string.Empty,
                        FriendlyName = n.FriendlyName?.ToString() ?? FormatPhone(n.PhoneNumber?.ToString()),
                        Locality = n.Locality,
                        Region = n.Region,
                        PostalCode = n.PostalCode,
                        Sms = n.Capabilities?.Sms == true,
                        Mms = n.Capabilities?.Mms == true,
                        Voice = n.Capabilities?.Voice == true
                    })
                    .ToList();
            }
            catch (ApiException ex)
            {
                _logger.LogError(ex, "Twilio available-number search failed. Status {Status}, Code {Code}, MoreInfo {MoreInfo}", ex.Status, ex.Code, ex.MoreInfo);
                throw new TwilioApiOperationException("available-number search", ex);
            }
        }

        public async Task<(string Sid, string PhoneNumber, string FriendlyName, string Status)> PurchaseNumberAsync(string phoneNumber, string smsWebhookUrl, string? friendlyName = null, CancellationToken cancellationToken = default)
        {
            if (!_isConfigured)
            {
                throw new InvalidOperationException("Twilio AccountSid/AuthToken are not configured.");
            }

            if (string.IsNullOrWhiteSpace(phoneNumber))
            {
                throw new ArgumentException("Phone number is required.", nameof(phoneNumber));
            }

            try
            {
                var twilioFriendlyName = string.IsNullOrWhiteSpace(friendlyName) ? null! : friendlyName.Trim();
                var purchased = await IncomingPhoneNumberResource.CreateAsync(
                    phoneNumber: new PhoneNumber(phoneNumber),
                    friendlyName: twilioFriendlyName,
                    smsUrl: new Uri(smsWebhookUrl),
                    smsMethod: Twilio.Http.HttpMethod.Post);

                _logger.LogInformation("Purchased Twilio SMS number {PhoneNumber} with SID {Sid}; status {Status}", purchased.PhoneNumber, purchased.Sid, purchased.Status);

                await AddNumberToMessagingServiceAsync(purchased.Sid, cancellationToken);

                return (
                    purchased.Sid,
                    purchased.PhoneNumber?.ToString() ?? phoneNumber,
                    purchased.FriendlyName ?? FormatPhone(purchased.PhoneNumber?.ToString()),
                    purchased.Status?.ToString() ?? "Active");
            }
            catch (ApiException ex)
            {
                _logger.LogError(ex, "Twilio phone-number purchase failed for {PhoneNumber}. Status {Status}, Code {Code}, MoreInfo {MoreInfo}", phoneNumber, ex.Status, ex.Code, ex.MoreInfo);
                throw new TwilioApiOperationException("phone-number purchase", ex);
            }
        }

        public async Task<string?> GetPhoneNumberStatusAsync(string twilioPhoneNumberSid, CancellationToken cancellationToken = default)
        {
            if (!_isConfigured)
            {
                throw new InvalidOperationException("Twilio AccountSid/AuthToken are not configured.");
            }

            try
            {
                var number = await IncomingPhoneNumberResource.FetchAsync(pathSid: twilioPhoneNumberSid);
                return number.Status?.ToString();
            }
            catch (ApiException ex)
            {
                _logger.LogError(ex, "Twilio phone-number status fetch failed for SID {Sid}. Status {Status}, Code {Code}, MoreInfo {MoreInfo}", twilioPhoneNumberSid, ex.Status, ex.Code, ex.MoreInfo);
                throw new TwilioApiOperationException("phone-number status fetch", ex);
            }
        }

        private async Task AddNumberToMessagingServiceAsync(string? phoneNumberSid, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_settings.MessagingServiceSid))
            {
                _logger.LogWarning("Twilio MessagingServiceSid is not configured; purchased number {PhoneNumberSid} was not added to a Messaging Service/A2P campaign automatically.", phoneNumberSid);
                return;
            }

            if (string.IsNullOrWhiteSpace(phoneNumberSid))
            {
                throw new InvalidOperationException("Twilio did not return a phone number SID for the purchased number.");
            }

            try
            {
                await MessagingServicePhoneNumberResource.CreateAsync(
                    pathServiceSid: _settings.MessagingServiceSid,
                    phoneNumberSid: phoneNumberSid);

                _logger.LogInformation("Added Twilio phone number SID {PhoneNumberSid} to Messaging Service {MessagingServiceSid}", phoneNumberSid, _settings.MessagingServiceSid);
            }
            catch (ApiException ex)
            {
                _logger.LogError(ex, "Failed to add Twilio phone number SID {PhoneNumberSid} to Messaging Service {MessagingServiceSid}. Status {Status}, Code {Code}, MoreInfo {MoreInfo}", phoneNumberSid, _settings.MessagingServiceSid, ex.Status, ex.Code, ex.MoreInfo);
                throw new TwilioApiOperationException("messaging-service phone-number attach", ex);
            }
        }

        private static bool IsValidAreaCode(string value) => value.Length == 3 && value.All(char.IsDigit);

        private static string FormatPhone(string? phoneNumber)
        {
            var digits = new string((phoneNumber ?? string.Empty).Where(char.IsDigit).ToArray());
            if (digits.Length == 11 && digits.StartsWith("1")) digits = digits[1..];
            return digits.Length == 10 ? $"({digits[..3]}) {digits[3..6]}-{digits[6..]}" : (phoneNumber ?? string.Empty);
        }
    }
}
