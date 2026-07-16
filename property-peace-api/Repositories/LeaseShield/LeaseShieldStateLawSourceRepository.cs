using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public class LeaseShieldStateLawSourceRepository : ILeaseShieldStateLawSourceRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseShieldStateLawSourceRepository> _logger;

        public LeaseShieldStateLawSourceRepository(DataContext context, ILogger<LeaseShieldStateLawSourceRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<LeaseShieldStateLawSource?> GetByStateAsync(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state)) return null;
            return await _context.LeaseShieldStateLawSources
                .FirstOrDefaultAsync(x => x.State == state.Trim().ToUpperInvariant(), cancellationToken);
        }

        public async Task<List<LeaseShieldStateLawSource>> GetAllAsync(CancellationToken cancellationToken = default)
        {
            return await _context.LeaseShieldStateLawSources
                .OrderBy(x => x.State)
                .ToListAsync(cancellationToken);
        }

        public async Task<LeaseShieldStateLawSource> UpsertAsync(string state, string? baseUrl, string? description, string? contentUrl = null, CancellationToken cancellationToken = default)
        {
            var key = state?.Trim().ToUpperInvariant() ?? string.Empty;
            var existing = await _context.LeaseShieldStateLawSources.FirstOrDefaultAsync(x => x.State == key, cancellationToken);
            var now = DateTime.UtcNow;
            if (existing != null)
            {
                existing.BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim();
                existing.Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
                existing.ContentUrl = string.IsNullOrWhiteSpace(contentUrl) ? null : contentUrl.Trim();
                existing.UpdatedAt = now;
                await _context.SaveChangesAsync(cancellationToken);
                return existing;
            }
            var entity = new LeaseShieldStateLawSource
            {
                State = key,
                BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim(),
                Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                ContentUrl = string.IsNullOrWhiteSpace(contentUrl) ? null : contentUrl.Trim(),
                UpdatedAt = now
            };
            _context.LeaseShieldStateLawSources.Add(entity);
            await _context.SaveChangesAsync(cancellationToken);
            return entity;
        }

        public async Task<bool> DeleteByStateAsync(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state)) return false;
            var key = state.Trim().ToUpperInvariant();
            var existing = await _context.LeaseShieldStateLawSources.FirstOrDefaultAsync(x => x.State == key, cancellationToken);
            if (existing == null) return false;
            _context.LeaseShieldStateLawSources.Remove(existing);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
