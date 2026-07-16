using brownstone_hub_api.Dtos.SupportRequest;

namespace brownstone_hub_api.Services.SupportRequestService
{
    public interface ISupportRequestService
    {
        Task<ServiceResponse<bool>> SubmitSupportRequest(SubmitSupportRequestDto request);
    }
}

