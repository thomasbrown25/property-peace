using brownstone_hub_api.Dtos.ActionSuppression;

namespace brownstone_hub_api.Services.ActionSuppressionService
{
    public interface IActionSuppressionService
    {
        Task<LoadActionSuppressionDto> CreateSuppression(AddActionSuppressionDto suppression, long organizationId, long createdBy);
        Task<bool> IsActionSuppressed(string actionType, long entityId, long organizationId);
        Task<int> CleanupExpiredSuppressions(long organizationId);
        Task<int> CleanupResolvedIssues(long organizationId);
        Task<List<LoadActionSuppressionDto>> GetActiveSuppressionsByOrganization(long organizationId);
        Task<int> DeleteSuppressionsByEntityId(long entityId, string actionType);
    }
}
