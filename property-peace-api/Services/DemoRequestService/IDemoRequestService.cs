using brownstone_hub_api.Dtos.DemoRequest;

namespace brownstone_hub_api.Services.DemoRequestService
{
    public interface IDemoRequestService
    {
        Task<ServiceResponse<LoadDemoRequestDto>> AddDemoRequest(AddDemoRequestDto demoRequest);
        Task<ServiceResponse<LoadDemoRequestDto>> GetDemoRequestById(long id);
        Task<ServiceResponse<List<LoadDemoRequestDto>>> GetAllDemoRequests();
        Task<ServiceResponse<List<LoadDemoRequestDto>>> GetDemoRequestsByDateRange(DateTime? startDate, DateTime? endDate);
    }
}
