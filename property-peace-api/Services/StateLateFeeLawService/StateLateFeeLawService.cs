using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.StateLateFeeLaws;

namespace brownstone_hub_api.Services.StateLateFeeLawService
{
    public class StateLateFeeLawService : IStateLateFeeLawService
    {
        private readonly IStateLateFeeLawRepository _repository;
        private readonly ILogger<StateLateFeeLawService> _logger;

        public StateLateFeeLawService(
            IStateLateFeeLawRepository repository,
            ILogger<StateLateFeeLawService> logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<StateLateFeeLaw?> GetStateLawAsync(string state)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(state))
                {
                    return null;
                }

                return await _repository.GetByStateAsync(state);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting state law for state {State}", state);
                throw;
            }
        }

        public async Task<List<StateLateFeeLaw>> GetAllStateLawsAsync()
        {
            try
            {
                return await _repository.GetAllAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all state laws");
                throw;
            }
        }

        public async Task<StateLateFeeLaw> UpdateStateLawAsync(string state, string? gracePeriodDescription, string? feeAmountDescription, string? updatedBy = null)
        {
            try
            {
                var law = new StateLateFeeLaw
                {
                    State = state,
                    GracePeriodDescription = gracePeriodDescription,
                    FeeAmountDescription = feeAmountDescription,
                    LastUpdatedBy = updatedBy ?? "Manual"
                };

                return await _repository.AddOrUpdateAsync(law);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating state law for state {State}", state);
                throw;
            }
        }

        public async Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30)
        {
            try
            {
                return await _repository.GetStatesNeedingUpdateAsync(daysThreshold);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting states needing update");
                throw;
            }
        }
    }
}
