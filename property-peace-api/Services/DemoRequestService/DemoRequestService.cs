using brownstone_hub_api.Dtos.DemoRequest;
using brownstone_hub_api.Repositories.DemoRequests;

namespace brownstone_hub_api.Services.DemoRequestService
{
    public class DemoRequestService(IDemoRequestRepository demoRequestRepository, ILogger<DemoRequestService> logger) : IDemoRequestService
    {
        private readonly IDemoRequestRepository _demoRequestRepository = demoRequestRepository;
        private readonly ILogger<DemoRequestService> _logger = logger;

        public async Task<ServiceResponse<LoadDemoRequestDto>> AddDemoRequest(AddDemoRequestDto demoRequest)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(demoRequest.Email))
                {
                    return ServiceResponse<LoadDemoRequestDto>.CreateError("Email is required", "Email field cannot be empty", "", 400);
                }

                if (string.IsNullOrWhiteSpace(demoRequest.FirstName) || string.IsNullOrWhiteSpace(demoRequest.LastName))
                {
                    return ServiceResponse<LoadDemoRequestDto>.CreateError("Name is required", "First name and last name are required", "", 400);
                }

                var result = await _demoRequestRepository.AddDemoRequest(demoRequest);
                _logger.LogInformation("Demo request created successfully for {Email}", demoRequest.Email);

                return ServiceResponse<LoadDemoRequestDto>.CreateSuccess(result, "Demo request created successfully", 201);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating demo request");
                return ServiceResponse<LoadDemoRequestDto>.CreateError("Error creating demo request", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<LoadDemoRequestDto>> GetDemoRequestById(long id)
        {
            try
            {
                var result = await _demoRequestRepository.GetDemoRequestById(id);
                
                if (result == null)
                {
                    return ServiceResponse<LoadDemoRequestDto>.CreateError("Demo request not found", $"Demo request with ID {id} was not found", "", 404);
                }

                return ServiceResponse<LoadDemoRequestDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting demo request {RequestId}", id);
                return ServiceResponse<LoadDemoRequestDto>.CreateError("Error getting demo request", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadDemoRequestDto>>> GetAllDemoRequests()
        {
            try
            {
                var result = await _demoRequestRepository.GetAllDemoRequests();
                return ServiceResponse<List<LoadDemoRequestDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all demo requests");
                return ServiceResponse<List<LoadDemoRequestDto>>.CreateError("Error getting all demo requests", ex.Message, ex.StackTrace ?? "", 500);
            }
        }

        public async Task<ServiceResponse<List<LoadDemoRequestDto>>> GetDemoRequestsByDateRange(DateTime? startDate, DateTime? endDate)
        {
            try
            {
                var result = await _demoRequestRepository.GetDemoRequestsByDateRange(startDate, endDate);
                return ServiceResponse<List<LoadDemoRequestDto>>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting demo requests by date range");
                return ServiceResponse<List<LoadDemoRequestDto>>.CreateError("Error getting demo requests by date range", ex.Message, ex.StackTrace ?? "", 500);
            }
        }
    }
}
