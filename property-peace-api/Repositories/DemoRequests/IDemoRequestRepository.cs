using brownstone_hub_api.Dtos.DemoRequest;

namespace brownstone_hub_api.Repositories.DemoRequests
{
    public interface IDemoRequestRepository
    {
        Task<LoadDemoRequestDto> AddDemoRequest(AddDemoRequestDto demoRequest);
        Task<LoadDemoRequestDto?> GetDemoRequestById(long id);
        Task<List<LoadDemoRequestDto>> GetAllDemoRequests();
        Task<List<LoadDemoRequestDto>> GetDemoRequestsByDateRange(DateTime? startDate, DateTime? endDate);
        Task<LoadDemoRequestDto?> UpdateDemoRequest(long id, string? calendlyEventUri, DateTime? scheduledDateTime, string? calendlyInviteeUri);
    }
}
