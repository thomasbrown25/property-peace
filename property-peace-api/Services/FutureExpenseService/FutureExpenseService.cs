using brownstone_hub_api.Dtos.FutureExpense;
using brownstone_hub_api.Repositories.FutureExpenses;
using Microsoft.AspNetCore.Http;
using brownstone_hub_api.Data;

namespace brownstone_hub_api.Services.FutureExpenseService
{
    public class FutureExpenseService(
        IFutureExpenseRepository futureExpenseRepository,
        IHttpContextAccessor httpContextAccessor,
        DataContext dataContext,
        ILogger<FutureExpenseService> logger) : IFutureExpenseService
    {
        private readonly IFutureExpenseRepository _futureExpenseRepository = futureExpenseRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<FutureExpenseService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadFutureExpenseDto>> AddFutureExpense(AddFutureExpenseDto futureExpense)
        {
            var response = new ServiceResponse<LoadFutureExpenseDto>();
            try
            {
                _logger.LogInformation("[FutureExpenseService] AddFutureExpense called: LandlordId={LandlordId}, PropertyId={PropertyId}, Name={Name}, Amount={Amount}, DueDate={DueDate}", 
                    futureExpense.LandlordId, futureExpense.PropertyId, futureExpense.Name, futureExpense.Amount, futureExpense.DueDate);
                
                var organizationId = GetOrganizationIdFromContext();
                _logger.LogInformation("[FutureExpenseService] OrganizationId from context: {OrganizationId}", organizationId);
                
                if (!organizationId.HasValue)
                {
                    _logger.LogWarning("[FutureExpenseService] OrganizationId is null - future expense may not be retrievable by organization");
                }
                
                var result = await _futureExpenseRepository.AddFutureExpense(futureExpense, organizationId);
                _logger.LogInformation("[FutureExpenseService] FutureExpense created successfully: Id={Id}", result?.Id);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseService] Error adding future expense: {Message}", ex.Message);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteFutureExpense(long futureExpenseId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                var result = await _futureExpenseRepository.DeleteFutureExpense(futureExpenseId);
                response.Data = result;
                if (!result)
                {
                    response.Success = false;
                    response.Message = "Future expense not found";
                    response.StatusCode = 404;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseService] Error deleting future expense {FutureExpenseId}", futureExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadFutureExpenseDto>> GetFutureExpenseById(long futureExpenseId)
        {
            var response = new ServiceResponse<LoadFutureExpenseDto>();
            try
            {
                var result = await _futureExpenseRepository.GetFutureExpenseById(futureExpenseId);
                if (result == null)
                {
                    response.Success = false;
                    response.Message = "Future expense not found";
                    response.StatusCode = 404;
                }
                else
                {
                    response.Data = result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseService] Error retrieving future expense {FutureExpenseId}", futureExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadFutureExpenseDto>>> GetFutureExpenses(long landlordId, long? propertyId = null)
        {
            var response = new ServiceResponse<List<LoadFutureExpenseDto>>();
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (organizationId.HasValue)
                {
                    var result = await _futureExpenseRepository.GetFutureExpensesByOrganizationId(organizationId.Value, propertyId);
                    response.Data = result;
                }
                else
                {
                    var result = await _futureExpenseRepository.GetFutureExpensesByLandlordId(landlordId, propertyId);
                    response.Data = result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseService] Error retrieving future expenses for landlord {LandlordId}", landlordId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}
