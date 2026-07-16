namespace brownstone_hub_api.Services.SmsService
{
    public interface IInboundSmsService
    {
        /// <summary>
        /// Routes an inbound SMS from Twilio into the correct conversation.
        /// Looks up the tenant by phone number, finds their most recent active conversation,
        /// saves the message, and broadcasts via SignalR.
        /// Returns a TwiML response string.
        /// </summary>
        Task<string> HandleInboundAsync(string fromPhone, string toPhone, string body);
    }
}
