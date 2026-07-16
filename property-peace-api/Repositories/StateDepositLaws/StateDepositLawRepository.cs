using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.StateDepositLaws
{
    public class StateDepositLawRepository : IStateDepositLawRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<StateDepositLawRepository> _logger;

        public StateDepositLawRepository(DataContext context, ILogger<StateDepositLawRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<StateDepositLaw?> GetByStateAsync(string state)
        {
            try
            {
                return await _context.StateDepositLaws
                    .FirstOrDefaultAsync(s => s.State == state.ToUpper());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting state deposit law for state {State}", state);
                throw;
            }
        }

        public async Task<List<StateDepositLaw>> GetAllAsync()
        {
            try
            {
                return await _context.StateDepositLaws
                    .OrderBy(s => s.State)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all state deposit laws");
                throw;
            }
        }

        public async Task<StateDepositLaw> AddOrUpdateAsync(StateDepositLaw law)
        {
            try
            {
                var existing = await _context.StateDepositLaws
                    .FirstOrDefaultAsync(s => s.State == law.State.ToUpper());

                if (existing != null)
                {
                    existing.BulletPointsText = law.BulletPointsText;
                    existing.LastUpdated = DateTime.UtcNow;
                    existing.LastUpdatedBy = law.LastUpdatedBy;
                    existing.UpdatedAt = DateTime.UtcNow;

                    _context.StateDepositLaws.Update(existing);
                    await _context.SaveChangesAsync();
                    return existing;
                }
                else
                {
                    law.State = law.State.ToUpper();
                    law.CreatedAt = DateTime.UtcNow;
                    law.LastUpdated = DateTime.UtcNow;

                    var entry = await _context.StateDepositLaws.AddAsync(law);
                    await _context.SaveChangesAsync();
                    return entry.Entity;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding or updating state deposit law for state {State}", law.State);
                throw;
            }
        }

        public async Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30)
        {
            try
            {
                var cutoffDate = DateTime.UtcNow.AddDays(-daysThreshold);

                var allStates = new List<string>
                {
                    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
                    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
                    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
                    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
                    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
                };

                var existingStates = await _context.StateDepositLaws
                    .Where(s => s.LastUpdated >= cutoffDate)
                    .Select(s => s.State)
                    .ToListAsync();

                var statesNeedingUpdate = allStates
                    .Where(s => !existingStates.Contains(s.ToUpper()))
                    .ToList();

                return statesNeedingUpdate;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting states needing update");
                throw;
            }
        }
    }
}
