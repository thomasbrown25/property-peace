using brownstone_hub_api.Dtos.TenantDocument;

namespace brownstone_hub_api.Services.TenantDocumentService
{
    public interface ITenantDocumentService
    {
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> AddTenantDocuments(long tenantId, List<IFormFile> files, string? description, Enums.ETenantDocumentType documentType, DateTime? expirationDate, bool isRequired, long? leaseId, bool isPrivate = false);
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> AddLeaseDocuments(long leaseId, List<IFormFile> files, string? description, Enums.ETenantDocumentType documentType, bool isPrivate = false);
        Task<ServiceResponse<LoadTenantDocumentDto>> GetTenantDocumentById(long id);
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByTenantId(long tenantId);
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByLandlordId(long landlordId);
        Task<ServiceResponse<LoadTenantDocumentDto>> GetLeaseAgreementByLeaseId(long leaseId);
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByLeaseId(long leaseId);
        Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetExpiringDocuments(long landlordId, int daysAhead = 30);
        Task<ServiceResponse<LoadTenantDocumentDto>> UpdateTenantDocument(UpdateTenantDocumentDto document);
        Task<ServiceResponse<bool>> DeleteTenantDocument(long id);
    }
}

