namespace brownstone_hub_api.Services.StateLawSourceService
{
    public interface IStateLawSourceService
    {
        Task<string?> GetLateFeeUrlAsync(string state, CancellationToken cancellationToken = default);
        Task<string?> GetSecurityDepositUrlAsync(string state, CancellationToken cancellationToken = default);
        Task<string?> FetchPageTextAsync(string url, CancellationToken cancellationToken = default);
    }
}
