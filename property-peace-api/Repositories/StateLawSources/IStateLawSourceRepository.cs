using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.StateLawSources
{
    public interface IStateLawSourceRepository
    {
        Task<List<StateLawSource>> GetAllAsync();
        Task<StateLawSource?> GetByStateAsync(string state);
        Task<StateLawSource> UpsertAsync(string state, string? lateFeeUrl, string? securityDepositUrl);
    }
}
