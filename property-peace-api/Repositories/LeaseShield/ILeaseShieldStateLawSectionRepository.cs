using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public interface ILeaseShieldStateLawSectionRepository
    {
        Task<List<LeaseShieldStateLawSection>> GetByStateAsync(string state, CancellationToken cancellationToken = default);
    }
}
