namespace brownstone_hub_api.Services.SmsService
{
    public sealed record SmsSubmissionResult(bool Accepted, string Provider, string? ProviderMessageId,
        string? ErrorCode = null, string? ErrorDetail = null, bool Retryable = true)
    {
        public static implicit operator SmsSubmissionResult(bool accepted) =>
            new(accepted, "unknown", null, accepted ? null : "submission_failed");
    }

    public interface ISmsService
    {
        Task<bool> SendSmsAsync(string to, string message, CancellationToken cancellationToken = default, string? from = null);
        async Task<SmsSubmissionResult> SubmitSmsAsync(string to, string message, CancellationToken cancellationToken = default, string? from = null,
            string? idempotencyToken = null) =>
            new(await SendSmsAsync(to, message, cancellationToken, from), "legacy-sms", null);
        Task<bool> SendBulkSmsAsync(List<string> to, string message, CancellationToken cancellationToken = default);
    }
}

