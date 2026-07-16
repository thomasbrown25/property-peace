using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Utils;
using Microsoft.AspNetCore.Http;
using brownstone_hub_api.Data;

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

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> AddRecurringExpense(AddRecurringExpenseDto recurringExpense)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                _logger.LogInformation("[RecurringExpenseService] AddRecurringExpense called: LandlordId={LandlordId}, PropertyId={PropertyId}, Name={Name}, Amount={Amount}", 
                    recurringExpense.LandlordId, recurringExpense.PropertyId, recurringExpense.Name, recurringExpense.Amount);
                
                // Get OrganizationId from context (required for filtering)
                var organizationId = GetOrganizationIdFromContext();
                _logger.LogInformation("[RecurringExpenseService] OrganizationId from context: {OrganizationId}", organizationId);
                
                if (!organizationId.HasValue)
                {
                    _logger.LogWarning("[RecurringExpenseService] OrganizationId is null - recurring expense may not be retrievable by organization");
                }
                
                var result = await _recurringExpenseRepository.AddRecurringExpense(recurringExpense, organizationId);
                _logger.LogInformation("[RecurringExpenseService] RecurringExpense created successfully: Id={Id}", result?.Id);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RecurringExpenseService] Error adding recurring expense: {Message}", ex.Message);
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
                var result = await _recurringExpenseRepository.UpdateRecurringExpense(recurringExpense);
                response.Data = result;
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Recurring expense not found for update");
                response.Success = false;
                response.Message = "Recurring expense not found";
                response.StatusCode = 404;
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
                var result = await _recurringExpenseRepository.DeleteRecurringExpense(recurringExpenseId);
                response.Data = result;
                if (!result)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = 404;
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
                var result = await _recurringExpenseRepository.GetRecurringExpenseById(recurringExpenseId);
                if (result == null)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = 404;
                }
                else
                {
                    response.Data = result;
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

        public async Task<ServiceResponse<List<LoadRecurringExpenseDto>>> GetRecurringExpenses(long landlordId, long? propertyId = null)
        {
            var response = new ServiceResponse<List<LoadRecurringExpenseDto>>();
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Organization ID is required";
                    response.StatusCode = 400;
                    return response;
                }

                var result = await _recurringExpenseRepository.GetRecurringExpensesByOrganizationId(organizationId.Value, propertyId);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expenses for landlord {LandlordId}", landlordId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> PauseRecurringExpense(long recurringExpenseId)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                var existing = await _recurringExpenseRepository.GetRecurringExpenseById(recurringExpenseId);
                if (existing == null)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = 404;
                    return response;
                }

                var updateDto = new UpdateRecurringExpenseDto
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
                    IsPaused = true
                };

                var result = await _recurringExpenseRepository.UpdateRecurringExpense(updateDto);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing recurring expense {RecurringExpenseId}", recurringExpenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadRecurringExpenseDto>> ResumeRecurringExpense(long recurringExpenseId)
        {
            var response = new ServiceResponse<LoadRecurringExpenseDto>();
            try
            {
                var existing = await _recurringExpenseRepository.GetRecurringExpenseById(recurringExpenseId);
                if (existing == null)
                {
                    response.Success = false;
                    response.Message = "Recurring expense not found";
                    response.StatusCode = 404;
                    return response;
                }

                var updateDto = new UpdateRecurringExpenseDto
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
                    IsPaused = false
                };

                var result = await _recurringExpenseRepository.UpdateRecurringExpense(updateDto);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming recurring expense {RecurringExpenseId}", recurringExpenseId);
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

                int generatedCount = 0;
                foreach (var recurringExpense in recurringExpenses)
                {
                    try
                    {
                        // Calculate the next occurrence date
                        var nextOccurrence = RecurringExpenseCalculator.CalculateNextOccurrence(
                            recurringExpense.Frequency,
                            recurringExpense.DayOfPeriod,
                            recurringExpense.StartDate,
                            recurringExpense.LastGeneratedDate,
                            recurringExpense.EndDate);

                        if (!nextOccurrence.HasValue || nextOccurrence.Value > today)
                            continue;

                        // Create the expense from the template
                        var expenseDto = new AddExpenseDto
                        {
                            LandlordId = recurringExpense.LandlordId,
                            PropertyId = recurringExpense.PropertyId,
                            UnitId = recurringExpense.UnitId,
                            Category = recurringExpense.Category,
                            Amount = recurringExpense.Amount,
                            ExpenseDate = nextOccurrence.Value,
                            Vendor = recurringExpense.Vendor,
                            PaymentMethod = recurringExpense.PaymentMethod,
                            IsRecurring = true, // Mark as generated from recurring template
                            IsTaxDeductible = recurringExpense.IsTaxDeductible,
                            MaintenanceRequestId = recurringExpense.MaintenanceRequestId
                        };

                        // Get OrganizationId from the property (this method may run in background jobs without HttpContext)
                        var property = await _dataContext.Properties.FindAsync(recurringExpense.PropertyId);
                        if (property?.OrganizationId == null)
                        {
                            _logger.LogWarning("Property {PropertyId} for recurring expense {RecurringExpenseId} does not have an OrganizationId. Skipping expense generation.", recurringExpense.PropertyId, recurringExpense.Id);
                            continue;
                        }

                        await _expenseRepository.AddExpense(expenseDto, property.OrganizationId.Value);

                        // Update the recurring expense's last generated date and next occurrence
                        await _recurringExpenseRepository.UpdateLastGeneratedDate(recurringExpense.Id, nextOccurrence.Value);

                        generatedCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error generating expense from recurring template {RecurringExpenseId}", recurringExpense.Id);
                        // Continue with other templates
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
