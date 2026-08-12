using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.FutureExpense;
using brownstone_hub_api.Repositories.FutureExpenses;
using Microsoft.AspNetCore.Http;

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
        private readonly ILogger<FutureExpenseService> _logger = logger;

        private long? GetOrganizationIdFromContext() =>
            _httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var value) == true && value is long id && id > 0
                ? id
                : null;

        private bool TryGetOrganizationId<T>(ServiceResponse<T> response, out long organizationId)
        {
            var current = GetOrganizationIdFromContext();
            if (current.HasValue)
            {
                organizationId = current.Value;
                return true;
            }

            organizationId = 0;
            response.Success = false;
            response.Message = "Organization context is required";
            response.StatusCode = StatusCodes.Status403Forbidden;
            return false;
        }

        public async Task<ServiceResponse<LoadFutureExpenseDto>> AddFutureExpense(AddFutureExpenseDto futureExpense)
        {
            var response = new ServiceResponse<LoadFutureExpenseDto>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _futureExpenseRepository.AddFutureExpense(futureExpense, organizationId);
            }
            catch (InvalidOperationException ex)
            {
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = StatusCodes.Status400BadRequest;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding future expense");
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
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _futureExpenseRepository.DeleteFutureExpense(futureExpenseId, organizationId);
                if (!response.Data)
                {
                    response.Success = false;
                    response.Message = "Future expense not found";
                    response.StatusCode = StatusCodes.Status404NotFound;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting future expense {FutureExpenseId}", futureExpenseId);
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
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _futureExpenseRepository.GetFutureExpenseById(futureExpenseId, organizationId);
                if (response.Data == null)
                {
                    response.Success = false;
                    response.Message = "Future expense not found";
                    response.StatusCode = StatusCodes.Status404NotFound;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving future expense {FutureExpenseId}", futureExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadFutureExpenseDto>>> GetFutureExpenses(long? propertyId = null, long? unitId = null)
        {
            var response = new ServiceResponse<List<LoadFutureExpenseDto>>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _futureExpenseRepository.GetFutureExpensesByOrganizationId(organizationId, propertyId, unitId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving future expenses for active organization");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}
