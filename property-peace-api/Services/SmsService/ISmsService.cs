namespace brownstone_hub_api.Services.SmsService
{
    public interface ISmsService
    {
        Task<bool> SendSmsAsync(string to, string message, CancellationToken cancellationToken = default, string? from = null);
        Task<bool> SendBulkSmsAsync(List<string> to, string message, CancellationToken cancellationToken = default);
    }
}

