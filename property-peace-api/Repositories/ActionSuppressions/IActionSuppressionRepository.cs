using brownstone_hub_api.Dtos.ActionSuppression;

namespace brownstone_hub_api.Repositories.ActionSuppressions
{
    public interface IActionSuppressionRepository
    {
        Task<LoadActionSuppressionDto> CreateSuppression(AddActionSuppressionDto suppression, long organizationId, long createdBy);
        Task<List<LoadActionSuppressionDto>> GetActiveSuppressionsByOrganization(long organizationId);
        Task<LoadActionSuppressionDto?> GetSuppressionByActionAndEntity(string actionType, long entityId, long organizationId);
        Task<bool> DeleteSuppression(long id);
        Task<int> DeleteExpiredSuppressions(long organizationId);
        Task<List<LoadActionSuppressionDto>> GetSuppressionsByActionType(string actionType, long organizationId);
        Task<int> DeleteSuppressionsByEntityId(long entityId, string actionType);
    }
}
