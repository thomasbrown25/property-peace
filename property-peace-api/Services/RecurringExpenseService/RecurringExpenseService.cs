using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.RecurringExpenseService
{
    public class RecurringExpenseService(
        IRecurringExpenseRepository recurringExpenseRepository,
        IExpenseRepository expenseRepository,
        IHttpContextAccessor httpContextAccessor,
        DataContext dataContext,
        ILogger<RecurringExpenseService> logger) : IRecurringExpenseService
    {
        private readonly IRecurringExpenseRepository _recurringExpenseRepository = recurringExpenseRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<RecurringExpenseService> _logger = logger;

        private bool TryGetOrganizationId<T>(ServiceResponse<T> response, out long organizationId)
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var value) == true &&
                value is long id && id > 0)
            {
                organizationId = id;
                return true;
            }

            organizationId = 0;
            response.Success = false;
            response.Message = "Organization context is required";
            response.StatusCode = StatusCodes.Status403Forbidden;
            return false;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> AddRecurringExpense(AddRecurringExpenseDto recurringExpense)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _recurringExpenseRepository.AddRecurringExpense(recurringExpense, organizationId);
            }
            catch (InvalidOperationException ex)
            {
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = StatusCodes.Status400BadRequest;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding recurring expense");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> UpdateRecurringExpense(UpdateRecurringExpenseDto recurringExpense)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _recurringExpenseRepository.UpdateRecurringExpense(recurringExpense, organizationId);
            }
            catch (KeyNotFoundException)
            {
                response.Success = false;
                response.Message = "Recurring expense not found";
                response.StatusCode = StatusCodes.Status404NotFound;
            }
            catch (InvalidOperationException ex)
            {
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = StatusCodes.Status400BadRequest;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating recurring expense");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteRecurringExpense(long recurringExpenseId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _recurringExpenseRepository.DeleteRecurringExpense(recurringExpenseId, organizationId);
                if (!response.Data)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = StatusCodes.Status404NotFound;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting recurring expense {RecurringExpenseId}", recurringExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> GetRecurringExpenseById(long recurringExpenseId)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _recurringExpenseRepository.GetRecurringExpenseById(recurringExpenseId, organizationId);
                if (response.Data == null)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = StatusCodes.Status404NotFound;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expense {RecurringExpenseId}", recurringExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadRecurringExpenseDto>>> GetRecurringExpenses(long? propertyId = null, long? unitId = null)
        {
            var response = new ServiceResponse<List<LoadRecurringExpenseDto>>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                response.Data = await _recurringExpenseRepository.GetRecurringExpensesByOrganizationId(
                    organizationId, propertyId, unitId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expenses for active organization");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> PauseRecurringExpense(long recurringExpenseId) =>
            await SetPaused(recurringExpenseId, true);

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> ResumeRecurringExpense(long recurringExpenseId) =>
            await SetPaused(recurringExpenseId, false);

        private async Task<ServiceResponse<LoadRecurringExpenseDto>> SetPaused(long recurringExpenseId, bool isPaused)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                if (!TryGetOrganizationId(response, out var organizationId)) return response;
                var existing = await _recurringExpenseRepository.GetRecurringExpenseById(recurringExpenseId, organizationId);
                if (existing == null)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = StatusCodes.Status404NotFound;
                    return response;
                }

                var update = new UpdateRecurringExpenseDto
                {
                    Id = existing.Id,
                    PropertyId = existing.PropertyId,
                    UnitId = existing.UnitId,
                    Name = existing.Name,
                    Category = existing.Category,
                    Amount = existing.Amount,
                    Frequency = existing.Frequency,
                    DayOfPeriod = existing.DayOfPeriod,
                    StartDate = existing.StartDate,
                    EndDate = existing.EndDate,
                    Notes = existing.Notes,
                    Vendor = existing.Vendor,
                    PaymentMethod = existing.PaymentMethod,
                    IsTaxDeductible = existing.IsTaxDeductible,
                    MaintenanceRequestId = existing.MaintenanceRequestId,
                    IsPaused = isPaused
                };

                response.Data = await _recurringExpenseRepository.UpdateRecurringExpense(update, organizationId);
            }
            catch (InvalidOperationException ex)
            {
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = StatusCodes.Status400BadRequest;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting pause state for recurring expense {RecurringExpenseId}", recurringExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<int>> GenerateExpensesFromRecurringTemplates()
        {
            var response = new ServiceResponse<int>();
            try
            {
                var today = DateTime.Today;
                var recurringExpenses = await _recurringExpenseRepository.GetRecurringExpensesDueForGeneration(today);
                var generatedCount = 0;

                foreach (var recurringExpense in recurringExpenses)
                {
                    try
                    {
                        var nextOccurrence = RecurringExpenseCalculator.CalculateNextOccurrence(
                            recurringExpense.Frequency,
                            recurringExpense.DayOfPeriod,
                            recurringExpense.StartDate,
                            recurringExpense.LastGeneratedDate,
                            recurringExpense.EndDate);

                        if (!nextOccurrence.HasValue || nextOccurrence.Value > today) continue;

                        // This path intentionally does not depend on HttpContext. Property ownership is canonical.
                        var property = await _dataContext.Properties.AsNoTracking().FirstOrDefaultAsync(p =>
                            p.Id == recurringExpense.PropertyId && p.OrganizationId.HasValue && !p.IsDeleted);
                        if (property == null)
                        {
                            _logger.LogWarning(
                                "Property {PropertyId} for recurring expense {RecurringExpenseId} has no active organization. Skipping generation.",
                                recurringExpense.PropertyId, recurringExpense.Id);
                            continue;
                        }

                        var expense = new AddExpenseDto
                        {
                            LandlordId = property.LandlordId,
                            PropertyId = property.Id,
                            UnitId = recurringExpense.UnitId,
                            Name = recurringExpense.Name,
                            Category = recurringExpense.Category,
                            Amount = recurringExpense.Amount,
                            ExpenseDate = nextOccurrence.Value,
                            Vendor = recurringExpense.Vendor,
                            PaymentMethod = recurringExpense.PaymentMethod,
                            IsRecurring = true,
                            IsTaxDeductible = recurringExpense.IsTaxDeductible,
                            MaintenanceRequestId = recurringExpense.MaintenanceRequestId
                        };

                        await _expenseRepository.AddExpense(expense, property.OrganizationId!.Value);
                        await _recurringExpenseRepository.UpdateLastGeneratedDate(recurringExpense.Id, nextOccurrence.Value);
                        generatedCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error generating expense from recurring template {RecurringExpenseId}", recurringExpense.Id);
                    }
                }

                response.Data = generatedCount;
                response.Message = $"Generated {generatedCount} expense(s) from recurring templates";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating expenses from recurring templates");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}
