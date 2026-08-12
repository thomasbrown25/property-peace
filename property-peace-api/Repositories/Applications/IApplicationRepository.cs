using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Repositories.Applications
{
    public interface IApplicationRepository
    {
        Task<LoadRentalApplicationDto> AddApplication(AddRentalApplicationDto application, long landlordId, long? organizationId = null);
        Task<LoadRentalApplicationDto?> GetApplicationById(long id);
        Task<bool?> IsApplicationOwnedByLandlordAndOrganization(long id, long landlordId, long organizationId);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByLandlordId(long landlordId);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByPropertyId(long propertyId);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByStatus(long landlordId, EApplicationStatus status);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByOrganizationId(long organizationId);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByStatusAndOrganizationId(long organizationId, EApplicationStatus status);
        Task<LoadRentalApplicationDto> UpdateApplication(UpdateRentalApplicationDto application);
        Task<bool> DeleteApplication(long id);
        Task<LoadRentalApplicationDto> UpdateApplicationPdfFields(long applicationId, string pdfBlobName, string pdfBlobUrl);
        Task<Models.RentalApplication?> GetApplicationEntityById(long id);
        Task<List<LoadRentalApplicationDto>> GetApplicationsByTenantEmail(string email);
        Task<int> DeleteApplicationsByPropertyId(long propertyId);
    }
}

