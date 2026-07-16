using Twilio.Exceptions;

namespace brownstone_hub_api.Services.OrganizationSmsNumberService
{
    public class TwilioApiOperationException : Exception
    {
        public string Operation { get; }
        public int? TwilioStatus { get; }
        public int? TwilioCode { get; }
        public string? MoreInfo { get; }

        public TwilioApiOperationException(string operation, ApiException apiException)
            : base($"Twilio {operation} failed ({apiException.Status}/{apiException.Code}): {apiException.Message}", apiException)
        {
            Operation = operation;
            TwilioStatus = apiException.Status;
            TwilioCode = apiException.Code;
            MoreInfo = apiException.MoreInfo;
        }
    }
}
