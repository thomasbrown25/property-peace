using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public class LeaseShieldStateLawSectionRepository : ILeaseShieldStateLawSectionRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseShieldStateLawSectionRepository> _logger;

        public LeaseShieldStateLawSectionRepository(DataContext context, ILogger<LeaseShieldStateLawSectionRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<LeaseShieldStateLawSection>> GetByStateAsync(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state)) return new List<LeaseShieldStateLawSection>();
            return await _context.LeaseShieldStateLawSections
                .Where(x => x.State == state.Trim().ToUpperInvariant())
                .OrderBy(x => x.DisplayOrder ?? int.MaxValue)
                .ThenBy(x => x.SectionCode)
                .ToListAsync(cancellationToken);
        }
    }
}
