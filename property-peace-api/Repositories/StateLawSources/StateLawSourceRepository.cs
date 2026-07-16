using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.StateLawSources
{
    public class StateLawSourceRepository : IStateLawSourceRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<StateLawSourceRepository> _logger;

        public StateLawSourceRepository(DataContext context, ILogger<StateLawSourceRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<StateLawSource>> GetAllAsync()
        {
            return await _context.StateLawSources.OrderBy(x => x.State).ToListAsync();
        }

        public async Task<StateLawSource?> GetByStateAsync(string state)
        {
            if (string.IsNullOrWhiteSpace(state)) return null;
            return await _context.StateLawSources.FirstOrDefaultAsync(x => x.State == state.ToUpperInvariant());
        }

        public async Task<StateLawSource> UpsertAsync(string state, string? lateFeeUrl, string? securityDepositUrl)
        {
            var key = state.ToUpperInvariant();
            var existing = await _context.StateLawSources.FirstOrDefaultAsync(x => x.State == key);
            var now = DateTime.UtcNow;
            if (existing != null)
            {
                existing.LateFeeUrl = string.IsNullOrWhiteSpace(lateFeeUrl) ? null : lateFeeUrl.Trim();
                existing.SecurityDepositUrl = string.IsNullOrWhiteSpace(securityDepositUrl) ? null : securityDepositUrl.Trim();
                existing.UpdatedAt = now;
                await _context.SaveChangesAsync();
                return existing;
            }
            var entity = new StateLawSource
            {
                State = key,
                LateFeeUrl = string.IsNullOrWhiteSpace(lateFeeUrl) ? null : lateFeeUrl.Trim(),
                SecurityDepositUrl = string.IsNullOrWhiteSpace(securityDepositUrl) ? null : securityDepositUrl.Trim(),
                UpdatedAt = now
            };
            _context.StateLawSources.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }
    }
}
