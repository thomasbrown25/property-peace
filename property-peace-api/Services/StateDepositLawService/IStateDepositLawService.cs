using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.StateDepositLawService
{
    public interface IStateDepositLawService
    {
        Task<StateDepositLaw?> GetStateLawAsync(string state);
        Task<List<StateDepositLaw>> GetAllStateLawsAsync();
        Task<StateDepositLaw> UpdateStateLawAsync(string state, string? bulletPointsText, string? updatedBy = null);
        Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30);
    }
}
