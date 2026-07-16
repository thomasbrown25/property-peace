using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.StateDepositLaws;

namespace brownstone_hub_api.Services.StateDepositLawService
{
    public class StateDepositLawService : IStateDepositLawService
    {
        private readonly IStateDepositLawRepository _repository;
        private readonly ILogger<StateDepositLawService> _logger;

        public StateDepositLawService(
            IStateDepositLawRepository repository,
            ILogger<StateDepositLawService> logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<StateDepositLaw?> GetStateLawAsync(string state)
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
                _logger.LogError(ex, "Error getting state deposit law for state {State}", state);
                throw;
            }
        }

        public async Task<List<StateDepositLaw>> GetAllStateLawsAsync()
        {
            try
            {
                return await _repository.GetAllAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all state deposit laws");
                throw;
            }
        }

        public async Task<StateDepositLaw> UpdateStateLawAsync(string state, string? bulletPointsText, string? updatedBy = null)
        {
            try
            {
                var law = new StateDepositLaw
                {
                    State = state,
                    BulletPointsText = bulletPointsText,
                    LastUpdatedBy = updatedBy ?? "Manual"
                };

                return await _repository.AddOrUpdateAsync(law);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating state deposit law for state {State}", state);
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
