using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseGeneration;

namespace brownstone_hub_api.Services.LeaseDocumentService
{
    public interface ILeaseDocumentService
    {
        Task<ServiceResponse<byte[]>> GeneratePreviewPdfFromLeaseAsync(LoadLeaseDto lease);
        Task<ServiceResponse<byte[]>> GeneratePdfAsync(long leaseInstanceId, long organizationId);
        Task<ServiceResponse<byte[]>> GenerateDocxAsync(long leaseInstanceId, long organizationId);
        Task<ServiceResponse<string>> SaveDocumentToBlobAsync(byte[] documentBytes, string fileName, long leaseInstanceId, string documentType, long organizationId);
        Task<ServiceResponse<byte[]>> GetDocumentAsync(long documentId, long organizationId);
        Task<ServiceResponse<List<LoadLeaseDocumentDto>>> GetDocumentsByInstanceAsync(long leaseInstanceId, long organizationId);
    }
}
