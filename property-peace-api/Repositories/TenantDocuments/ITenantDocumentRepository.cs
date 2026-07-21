using brownstone_hub_api.Dtos.TenantDocument;

namespace brownstone_hub_api.Repositories.TenantDocuments
{
    public interface ITenantDocumentRepository
    {
        Task<LoadTenantDocumentDto> AddTenantDocument(AddTenantDocumentDto document, long? organizationId = null);
        Task<bool> CanAccessTenant(long tenantId, long? organizationId, long? userId, bool isTenantUser);
        Task<bool> CanAccessLease(long leaseId, long? organizationId, long? userId, bool isTenantUser);
        Task<LoadTenantDocumentDto?> GetTenantDocumentById(long id, long? organizationId, long? userId, bool isTenantUser);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByTenantId(long tenantId, long? organizationId, long? userId, bool isTenantUser);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLandlordId(long landlordId);
        Task<LoadTenantDocumentDto?> GetLeaseAgreementByLeaseId(long leaseId, long? organizationId, long? userId, bool isTenantUser);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLeaseId(long leaseId, long? organizationId);
        Task<List<LoadTenantDocumentDto>> GetExpiringDocuments(long landlordId, int daysAhead = 30);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByOrganizationId(long organizationId);
        Task<List<LoadTenantDocumentDto>> GetExpiringDocumentsByOrganizationId(long organizationId, int daysAhead = 30);
        Task<LoadTenantDocumentDto> UpdateTenantDocument(UpdateTenantDocumentDto document, long? organizationId, long? userId, bool isTenantUser);
        Task<bool> DeleteTenantDocument(long id, long? organizationId, long? userId, bool isTenantUser);
        Task<int> DeleteTenantDocumentsByTenantIds(List<long> tenantIds);
    }
}

