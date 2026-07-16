using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.StateDepositLaws
{
    public interface IStateDepositLawRepository
    {
        Task<StateDepositLaw?> GetByStateAsync(string state);
        Task<List<StateDepositLaw>> GetAllAsync();
        Task<StateDepositLaw> AddOrUpdateAsync(StateDepositLaw law);
        Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30);
    }
}
