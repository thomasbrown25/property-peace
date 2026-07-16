namespace brownstone_hub_api.Services.EmailService
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default);
        Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent, string? senderAddress, CancellationToken cancellationToken = default);
        Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default);
    }
}

