using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Subscriptions
{
    public class SubscriptionHistoryRepository : ISubscriptionHistoryRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<SubscriptionHistoryRepository> _logger;

        public SubscriptionHistoryRepository(DataContext context, ILogger<SubscriptionHistoryRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<SubscriptionHistory> AddHistoryAsync(SubscriptionHistory history)
        {
            try
            {
                history.Timestamp = DateTime.Now;
                await _context.SubscriptionHistories.AddAsync(history);
                await _context.SaveChangesAsync();
                return history;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding subscription history for subscription {SubscriptionId}", history.SubscriptionId);
                throw;
            }
        }

        public async Task<List<SubscriptionHistory>> GetHistoryBySubscriptionIdAsync(long subscriptionId)
        {
            try
            {
                return await _context.SubscriptionHistories
                    .Where(sh => sh.SubscriptionId == subscriptionId)
                    .OrderByDescending(sh => sh.Timestamp)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription history for subscription {SubscriptionId}", subscriptionId);
                throw;
            }
        }
    }
}

