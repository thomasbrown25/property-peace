namespace brownstone_hub_api.Services.DailySummaryEmailService
{
    public interface IDailySummaryEmailService
    {
        Task RunDueDailySummariesAsync(CancellationToken cancellationToken = default);
        Task RunImmediateDailySummariesAsync(CancellationToken cancellationToken = default);
        Task<bool> UnsubscribeAsync(string token, CancellationToken cancellationToken = default);
    }
}
