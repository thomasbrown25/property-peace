using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.StateLateFeeLaws
{
    public class StateLateFeeLawRepository : IStateLateFeeLawRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<StateLateFeeLawRepository> _logger;

        public StateLateFeeLawRepository(DataContext context, ILogger<StateLateFeeLawRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<StateLateFeeLaw?> GetByStateAsync(string state)
        {
            try
            {
                return await _context.StateLateFeeLaws
                    .FirstOrDefaultAsync(s => s.State == state.ToUpper());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting state late fee law for state {State}", state);
                throw;
            }
        }

        public async Task<List<StateLateFeeLaw>> GetAllAsync()
        {
            try
            {
                return await _context.StateLateFeeLaws
                    .OrderBy(s => s.State)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all state late fee laws");
                throw;
            }
        }

        public async Task<StateLateFeeLaw> AddOrUpdateAsync(StateLateFeeLaw law)
        {
            try
            {
                var existing = await _context.StateLateFeeLaws
                    .FirstOrDefaultAsync(s => s.State == law.State.ToUpper());

                if (existing != null)
                {
                    // Update existing
                    existing.GracePeriodDescription = law.GracePeriodDescription;
                    existing.FeeAmountDescription = law.FeeAmountDescription;
                    existing.LastUpdated = DateTime.UtcNow;
                    existing.LastUpdatedBy = law.LastUpdatedBy;
                    existing.UpdatedAt = DateTime.UtcNow;

                    _context.StateLateFeeLaws.Update(existing);
                    await _context.SaveChangesAsync();
                    return existing;
                }
                else
                {
                    // Add new
                    law.State = law.State.ToUpper();
                    law.CreatedAt = DateTime.UtcNow;
                    law.LastUpdated = DateTime.UtcNow;
                    
                    var entry = await _context.StateLateFeeLaws.AddAsync(law);
                    await _context.SaveChangesAsync();
                    return entry.Entity;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding or updating state late fee law for state {State}", law.State);
                throw;
            }
        }

        public async Task<List<string>> GetStatesNeedingUpdateAsync(int daysThreshold = 30)
        {
            try
            {
                var cutoffDate = DateTime.UtcNow.AddDays(-daysThreshold);
                
                // Get all US states
                var allStates = new List<string>
                {
                    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
                    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
                    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
                    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
                    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
                };

                // Get states that don't exist or haven't been updated recently
                var existingStates = await _context.StateLateFeeLaws
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
