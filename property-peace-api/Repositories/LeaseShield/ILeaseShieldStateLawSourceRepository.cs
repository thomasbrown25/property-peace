using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public interface ILeaseShieldStateLawSourceRepository
    {
        Task<LeaseShieldStateLawSource?> GetByStateAsync(string state, CancellationToken cancellationToken = default);
        Task<List<LeaseShieldStateLawSource>> GetAllAsync(CancellationToken cancellationToken = default);
        Task<LeaseShieldStateLawSource> UpsertAsync(string state, string? baseUrl, string? description, string? contentUrl = null, CancellationToken cancellationToken = default);
        Task<bool> DeleteByStateAsync(string state, CancellationToken cancellationToken = default);
    }
}
