using brownstone_hub_api.Dtos.TenantDocument;

namespace brownstone_hub_api.Repositories.TenantDocuments
{
    public interface ITenantDocumentRepository
    {
        Task<LoadTenantDocumentDto> AddTenantDocument(AddTenantDocumentDto document, long? organizationId = null);
        Task<LoadTenantDocumentDto?> GetTenantDocumentById(long id);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByTenantId(long tenantId);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLandlordId(long landlordId);
        Task<LoadTenantDocumentDto?> GetLeaseAgreementByLeaseId(long leaseId);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLeaseId(long leaseId);
        Task<List<LoadTenantDocumentDto>> GetExpiringDocuments(long landlordId, int daysAhead = 30);
        Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByOrganizationId(long organizationId);
        Task<List<LoadTenantDocumentDto>> GetExpiringDocumentsByOrganizationId(long organizationId, int daysAhead = 30);
        Task<LoadTenantDocumentDto> UpdateTenantDocument(UpdateTenantDocumentDto document);
        Task<bool> DeleteTenantDocument(long id);
        Task<int> DeleteTenantDocumentsByTenantIds(List<long> tenantIds);
    }
}

