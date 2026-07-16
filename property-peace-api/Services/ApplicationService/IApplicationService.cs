using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Services.ApplicationService
{
    public interface IApplicationService
    {
        Task<ServiceResponse<LoadRentalApplicationDto>> AddApplication(AddRentalApplicationDto application);
        Task<ServiceResponse<LoadRentalApplicationDto>> GetApplicationById(long id);
        Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByLandlordId(long landlordId);
        Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByStatus(EApplicationStatus status);
        Task<ServiceResponse<LoadRentalApplicationDto>> UpdateApplication(UpdateRentalApplicationDto application);
        Task<ServiceResponse<bool>> DeleteApplication(long id);
        Task<ServiceResponse<LoadRentalApplicationDto>> UpdateApplicationStatus(long id, EApplicationStatus status, string? rejectionReason, string? reviewNotes);
        Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByTenantEmail();
        Task<ServiceResponse<LoadRentalApplicationDto>> SubmitPublicApplicationAsync(PublicApplicationSubmitDto dto);
    }
}

