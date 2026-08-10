using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public class LeaseShieldConversationRepository : ILeaseShieldConversationRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseShieldConversationRepository> _logger;

        public LeaseShieldConversationRepository(DataContext context, ILogger<LeaseShieldConversationRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<LeaseShieldConversation>> GetByUserIdAsync(long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            return await _context.LeaseShieldConversations
                .AsNoTracking()
                .Where(c => c.UserId == userId && c.OrganizationId == organizationId)
                .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<LeaseShieldConversation?> GetByIdAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            return await _context.LeaseShieldConversations
                .Include(c => c.Messages.OrderBy(m => m.CreatedAt))
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId && c.OrganizationId == organizationId, cancellationToken);
        }

        public async Task<LeaseShieldConversation> CreateAsync(long userId, long organizationId, string state, string title, CancellationToken cancellationToken = default)
        {
            var key = state?.Trim().ToUpperInvariant() ?? string.Empty;
            var entity = new LeaseShieldConversation
            {
                UserId = userId,
                OrganizationId = organizationId,
                State = key,
                Title = title?.Trim() ?? "New conversation",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.LeaseShieldConversations.Add(entity);
            await _context.SaveChangesAsync(cancellationToken);
            return entity;
        }

        public async Task<bool> UpdateTitleAsync(long conversationId, long userId, long organizationId, string title, CancellationToken cancellationToken = default)
        {
            var conv = await _context.LeaseShieldConversations
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId && c.OrganizationId == organizationId, cancellationToken);
            if (conv == null) return false;
            conv.Title = title?.Trim() ?? conv.Title;
            conv.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> DeleteAsync(long conversationId, long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            var conv = await _context.LeaseShieldConversations
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId && c.OrganizationId == organizationId, cancellationToken);
            if (conv == null) return false;
            _context.LeaseShieldConversations.Remove(conv);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
