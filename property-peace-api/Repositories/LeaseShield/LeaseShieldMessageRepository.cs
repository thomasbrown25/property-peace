using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.LeaseShield
{
    public class LeaseShieldMessageRepository : ILeaseShieldMessageRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<LeaseShieldMessageRepository> _logger;

        public LeaseShieldMessageRepository(DataContext context, ILogger<LeaseShieldMessageRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<LeaseShieldMessage>> GetByConversationIdAsync(long conversationId, long userId, CancellationToken cancellationToken = default)
        {
            var exists = await _context.LeaseShieldConversations
                .AnyAsync(c => c.Id == conversationId && c.UserId == userId, cancellationToken);
            if (!exists) return [];
            return await _context.LeaseShieldMessages
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<LeaseShieldMessage> AddAsync(long conversationId, string role, string content, string? sourceCitationsJson, string? state = null, CancellationToken cancellationToken = default)
        {
            var message = new LeaseShieldMessage
            {
                ConversationId = conversationId,
                Role = role,
                Content = content ?? string.Empty,
                SourceCitationsJson = sourceCitationsJson,
                State = !string.IsNullOrWhiteSpace(state) ? state.Trim().ToUpperInvariant() : null,
                CreatedAt = DateTime.UtcNow
            };
            _context.LeaseShieldMessages.Add(message);
            await _context.SaveChangesAsync(cancellationToken);
            return message;
        }

        public async Task<bool> UpdateConversationUpdatedAtAsync(long conversationId, CancellationToken cancellationToken = default)
        {
            var conv = await _context.LeaseShieldConversations.FindAsync([conversationId], cancellationToken);
            if (conv == null) return false;
            conv.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
