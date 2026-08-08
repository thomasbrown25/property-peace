namespace brownstone_hub_api.Services.EmailService
{
    public sealed record EmailSubmissionResult(bool Accepted, string Provider, string? ProviderMessageId,
        string? ErrorCode = null, string? ErrorDetail = null, bool Retryable = true)
    {
        public static implicit operator EmailSubmissionResult(bool accepted) =>
            new(accepted, "unknown", null, accepted ? null : "submission_failed");
    }

    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default);
        Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent, string? senderAddress, CancellationToken cancellationToken = default);
        async Task<EmailSubmissionResult> SubmitEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent = null, string? senderAddress = null, CancellationToken cancellationToken = default,
            string? idempotencyToken = null) =>
            new(await SendEmailAsync(to, subject, htmlContent, plainTextContent, senderAddress, cancellationToken), "legacy-email", null);
        Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent, string? plainTextContent = null, CancellationToken cancellationToken = default);
    }
}

