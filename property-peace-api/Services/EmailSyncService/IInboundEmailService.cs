namespace brownstone_hub_api.Services.EmailSyncService
{
    public interface IInboundEmailService
    {
        Task<bool> HandleInboundAsync(string fromEmail, string toEmail, string? subject, string? textBody,
            string? htmlBody, string providerEventId, CancellationToken cancellationToken = default);
    }
}
