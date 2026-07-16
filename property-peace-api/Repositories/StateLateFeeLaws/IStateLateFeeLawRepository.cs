using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.StateLateFeeLaws
{
    public interface IStateLateFeeLawRepository
    {
        Task<StateLateFeeLaw?> GetByStateAsync(string state);
        Task<List<StateLateFeeLaw>> GetAllAsync();
        Task<StateLateFeeLaw> AddOrUpdateAsync(StateLateFeeLaw law);
        Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30);
    }
}
