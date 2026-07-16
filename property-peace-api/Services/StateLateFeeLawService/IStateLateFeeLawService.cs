using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.StateLateFeeLawService
{
    public interface IStateLateFeeLawService
    {
        Task<StateLateFeeLaw?> GetStateLawAsync(string state);
        Task<List<StateLateFeeLaw>> GetAllStateLawsAsync();
        Task<StateLateFeeLaw> UpdateStateLawAsync(string state, string? gracePeriodDescription, string? feeAmountDescription, string? updatedBy = null);
        Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30);
    }
}
