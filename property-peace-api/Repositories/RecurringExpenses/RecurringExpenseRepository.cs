using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Repositories.Expenses;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.RecurringExpenses
{
    public class RecurringExpenseRepository(DataContext context, ILogger<RecurringExpenseRepository> logger, IMapper mapper) : IRecurringExpenseRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<RecurringExpenseRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadRecurringExpenseDto> AddRecurringExpense(AddRecurringExpenseDto recurringExpense, long organizationId)
        {
            try
            {
                _logger.LogInformation("[RecurringExpenseRepository] AddRecurringExpense called: LandlordId={LandlordId}, PropertyId={PropertyId}, OrganizationId={OrganizationId}, Name={Name}", 
                    recurringExpense.LandlordId, recurringExpense.PropertyId, organizationId, recurringExpense.Name);

                await ExpenseOrganizationGuard.ValidateAsync(_context, organizationId, recurringExpense.LandlordId,
                    recurringExpense.PropertyId, recurringExpense.UnitId, null, recurringExpense.MaintenanceRequestId);
                
                var entity = _mapper.Map<Models.RecurringExpense>(recurringExpense);
                entity.CreatedAt = DateTime.Now;
                entity.OrganizationId = organizationId;
                
                // Calculate next occurrence date
                entity.NextOccurrenceDate = Utils.RecurringExpenseCalculator.CalculateNextOccurrence(
                    entity.Frequency,
                    entity.DayOfPeriod,
                    entity.StartDate,
                    null,
                    entity.EndDate);

                _logger.LogInformation("[RecurringExpenseRepository] Calculated NextOccurrenceDate={NextOccurrenceDate}", entity.NextOccurrenceDate);

                await _context.RecurringExpenses.AddAsync(entity);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("[RecurringExpenseRepository] Saved recurring expense with Id={Id}", entity.Id);

                // Load with includes for DTO mapping
                var savedRecurringExpense = await _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .FirstOrDefaultAsync(e => e.Id == entity.Id);

                if (savedRecurringExpense == null)
                {
                    _logger.LogError("[RecurringExpenseRepository] Failed to retrieve saved recurring expense with Id={Id}", entity.Id);
                    throw new Exception("Failed to retrieve saved recurring expense");
                }

                _logger.LogInformation("[RecurringExpenseRepository] Successfully retrieved saved recurring expense: Id={Id}, OrganizationId={OrganizationId}", 
                    savedRecurringExpense.Id, savedRecurringExpense.OrganizationId);

                return _mapper.Map<LoadRecurringExpenseDto>(savedRecurringExpense);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RecurringExpenseRepository] Error adding recurring expense: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<LoadRecurringExpenseDto> UpdateRecurringExpense(UpdateRecurringExpenseDto recurringExpense, long organizationId)
        {
            try
            {
                var entity = await _context.RecurringExpenses
                    .FirstOrDefaultAsync(e => e.Id == recurringExpense.Id && e.OrganizationId == organizationId);
                if (entity == null)
                    throw new KeyNotFoundException($"Recurring expense with ID {recurringExpense.Id} not found");

                await ExpenseOrganizationGuard.ValidateReferencesAsync(_context, organizationId,
                    recurringExpense.PropertyId, recurringExpense.UnitId, null, recurringExpense.MaintenanceRequestId);

                entity.PropertyId = recurringExpense.PropertyId;
                entity.UnitId = recurringExpense.UnitId;
                entity.Name = recurringExpense.Name;
                entity.Category = recurringExpense.Category;
                entity.Amount = recurringExpense.Amount;
                entity.Frequency = recurringExpense.Frequency;
                entity.DayOfPeriod = recurringExpense.DayOfPeriod;
                entity.StartDate = recurringExpense.StartDate;
                entity.EndDate = recurringExpense.EndDate;
                entity.Notes = recurringExpense.Notes;
                entity.Vendor = recurringExpense.Vendor;
                entity.PaymentMethod = recurringExpense.PaymentMethod;
                entity.IsTaxDeductible = recurringExpense.IsTaxDeductible;
                entity.MaintenanceRequestId = recurringExpense.MaintenanceRequestId;
                entity.IsPaused = recurringExpense.IsPaused;
                entity.UpdatedAt = DateTime.Now;

                // Recalculate next occurrence date
                entity.NextOccurrenceDate = Utils.RecurringExpenseCalculator.CalculateNextOccurrence(
                    entity.Frequency,
                    entity.DayOfPeriod,
                    entity.StartDate,
                    entity.LastGeneratedDate,
                    entity.EndDate);

                await _context.SaveChangesAsync();

                // Reload with includes
                await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
                await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();

                return _mapper.Map<LoadRecurringExpenseDto>(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating recurring expense {RecurringExpenseId}", recurringExpense.Id);
                throw;
            }
        }

        public async Task<bool> DeleteRecurringExpense(long recurringExpenseId, long organizationId)
        {
            try
            {
                var recurringExpense = await _context.RecurringExpenses
                    .FirstOrDefaultAsync(e => e.Id == recurringExpenseId && e.OrganizationId == organizationId);
                if (recurringExpense == null)
                    return false;

                _context.RecurringExpenses.Remove(recurringExpense);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting recurring expense {RecurringExpenseId}", recurringExpenseId);
                throw;
            }
        }

        public async Task<LoadRecurringExpenseDto?> GetRecurringExpenseById(long recurringExpenseId, long organizationId)
        {
            try
            {
                var recurringExpense = await _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .FirstOrDefaultAsync(e => e.Id == recurringExpenseId && e.OrganizationId == organizationId);

                return recurringExpense == null ? null : _mapper.Map<LoadRecurringExpenseDto>(recurringExpense);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expense {RecurringExpenseId}", recurringExpenseId);
                throw;
            }
        }

        public async Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesByLandlordId(long landlordId, long? propertyId = null)
        {
            try
            {
                var query = _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Where(e => e.LandlordId == landlordId)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                var recurringExpenses = await query
                    .OrderByDescending(e => e.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadRecurringExpenseDto>>(recurringExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expenses for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesByOrganizationId(long organizationId, long? propertyId = null, long? unitId = null)
        {
            try
            {
                var query = _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Where(e => e.OrganizationId == organizationId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                if (unitId.HasValue)
                    query = query.Where(e => e.UnitId == unitId.Value);

                var recurringExpenses = await query
                    .OrderByDescending(e => e.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadRecurringExpenseDto>>(recurringExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expenses for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadRecurringExpenseDto>> GetActiveRecurringExpenses()
        {
            try
            {
                var today = DateTime.Today;
                var recurringExpenses = await _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Where(e => !e.IsPaused && 
                                e.StartDate <= today &&
                                (e.EndDate == null || e.EndDate >= today))
                    .ToListAsync();

                return _mapper.Map<List<LoadRecurringExpenseDto>>(recurringExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active recurring expenses");
                throw;
            }
        }

        public async Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesDueForGeneration(DateTime? beforeDate = null)
        {
            try
            {
                var checkDate = beforeDate ?? DateTime.Today;
                var recurringExpenses = await _context.RecurringExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Where(e => !e.IsPaused &&
                                e.StartDate <= checkDate &&
                                (e.EndDate == null || e.EndDate >= checkDate) &&
                                (e.NextOccurrenceDate == null || e.NextOccurrenceDate <= checkDate))
                    .ToListAsync();

                return _mapper.Map<List<LoadRecurringExpenseDto>>(recurringExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recurring expenses due for generation");
                throw;
            }
        }

        public async Task UpdateLastGeneratedDate(long recurringExpenseId, DateTime generatedDate)
        {
            try
            {
                var entity = await _context.RecurringExpenses.FindAsync(recurringExpenseId);
                if (entity == null)
                    throw new KeyNotFoundException($"Recurring expense with ID {recurringExpenseId} not found");

                entity.LastGeneratedDate = generatedDate;
                
                // Recalculate next occurrence date
                entity.NextOccurrenceDate = Utils.RecurringExpenseCalculator.CalculateNextOccurrence(
                    entity.Frequency,
                    entity.DayOfPeriod,
                    entity.StartDate,
                    entity.LastGeneratedDate,
                    entity.EndDate);

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating last generated date for recurring expense {RecurringExpenseId}", recurringExpenseId);
                throw;
            }
        }

        public async Task<int> DeleteRecurringExpensesByPropertyId(long propertyId)
        {
            try
            {
                var recurringExpenses = await _context.RecurringExpenses
                    .Where(re => re.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.RecurringExpenses.RemoveRange(recurringExpenses);
                await _context.SaveChangesAsync();
                
                return recurringExpenses.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting recurring expenses for property {PropertyId}", propertyId);
                throw;
            }
        }
    }
}
