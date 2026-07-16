using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.ActionSuppressions
{
    public class ActionSuppressionRepository(DataContext context, IMapper mapper) : IActionSuppressionRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadActionSuppressionDto> CreateSuppression(AddActionSuppressionDto suppression, long organizationId, long createdBy)
        {
            try
            {
                var newSuppression = new ActionSuppression
                {
                    ActionType = suppression.ActionType,
                    EntityId = suppression.EntityId,
                    OrganizationId = organizationId,
                    SuppressedUntil = suppression.SuppressedUntil,
                    SuppressedAt = DateTime.UtcNow,
                    CreatedBy = createdBy,
                    Reason = suppression.Reason,
                    IsActive = true
                };

                await _context.ActionSuppressions.AddAsync(newSuppression);
                
                var savedCount = await _context.SaveChangesAsync();
                
                // Verify the ID was assigned by the database
                if (newSuppression.Id == 0)
                {
                    throw new InvalidOperationException($"Suppression was saved but ID is still 0. SaveChangesAsync returned {savedCount} affected rows.");
                }
                
                return _mapper.Map<LoadActionSuppressionDto>(newSuppression);
            }
            catch (Exception ex)
            {
                // Log the full exception details and re-throw with context
                throw new InvalidOperationException(
                    $"Failed to create ActionSuppression: ActionType={suppression.ActionType}, EntityId={suppression.EntityId}, OrganizationId={organizationId}, CreatedBy={createdBy}. " +
                    $"Error: {ex.Message}", ex);
            }
        }

        public async Task<List<LoadActionSuppressionDto>> GetActiveSuppressionsByOrganization(long organizationId)
        {
            var now = DateTime.UtcNow;
            var suppressions = await _context.ActionSuppressions
                .Where(s => s.OrganizationId == organizationId 
                    && s.IsActive 
                    && (s.SuppressedUntil == null || s.SuppressedUntil > now)) // Null means permanently suppressed
                .ToListAsync();

            return _mapper.Map<List<LoadActionSuppressionDto>>(suppressions);
        }

        public async Task<LoadActionSuppressionDto?> GetSuppressionByActionAndEntity(string actionType, long entityId, long organizationId)
        {
            var now = DateTime.UtcNow;
            var suppression = await _context.ActionSuppressions
                .FirstOrDefaultAsync(s => s.ActionType == actionType
                    && s.EntityId == entityId
                    && s.OrganizationId == organizationId
                    && s.IsActive
                    && (s.SuppressedUntil == null || s.SuppressedUntil > now)); // Null means permanently suppressed

            return suppression == null ? null : _mapper.Map<LoadActionSuppressionDto>(suppression);
        }

        public async Task<bool> DeleteSuppression(long id)
        {
            var suppression = await _context.ActionSuppressions.FindAsync(id);
            if (suppression == null)
                return false;

            _context.ActionSuppressions.Remove(suppression);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> DeleteExpiredSuppressions(long organizationId)
        {
            var now = DateTime.UtcNow;
            var expiredSuppressions = await _context.ActionSuppressions
                .Where(s => s.OrganizationId == organizationId 
                    && s.SuppressedUntil != null // Don't delete permanently suppressed items
                    && s.SuppressedUntil <= now)
                .ToListAsync();

            _context.ActionSuppressions.RemoveRange(expiredSuppressions);
            await _context.SaveChangesAsync();
            return expiredSuppressions.Count;
        }

        public async Task<List<LoadActionSuppressionDto>> GetSuppressionsByActionType(string actionType, long organizationId)
        {
            var now = DateTime.UtcNow;
            var suppressions = await _context.ActionSuppressions
                .Where(s => s.ActionType == actionType
                    && s.OrganizationId == organizationId
                    && s.IsActive
                    && (s.SuppressedUntil == null || s.SuppressedUntil > now)) // Null means permanently suppressed
                .ToListAsync();

            return _mapper.Map<List<LoadActionSuppressionDto>>(suppressions);
        }

        public async Task<int> DeleteSuppressionsByEntityId(long entityId, string actionType)
        {
            var suppressions = await _context.ActionSuppressions
                .Where(s => s.EntityId == entityId && s.ActionType == actionType)
                .ToListAsync();

            if (suppressions.Count > 0)
            {
                _context.ActionSuppressions.RemoveRange(suppressions);
                await _context.SaveChangesAsync();
            }

            return suppressions.Count;
        }
    }
}
