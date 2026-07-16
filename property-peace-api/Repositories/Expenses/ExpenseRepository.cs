using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Expense;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Expenses
{
    public class ExpenseRepository(DataContext context, ILogger<ExpenseRepository> logger, IMapper mapper) : IExpenseRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<ExpenseRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadExpenseDto> AddExpense(AddExpenseDto expense, long organizationId)
        {
            try
            {
                // If organizationId not provided, try to get it from the property
                if (organizationId == 0)
                {
                    var property = await _context.Properties.FindAsync(expense.PropertyId);
                    if (property?.OrganizationId.HasValue == true)
                    {
                        organizationId = property.OrganizationId.Value;
                    }
                }

                _logger.LogInformation("[ExpenseRepository] AddExpense called: LandlordId={LandlordId}, OrganizationId={OrganizationId}, PropertyId={PropertyId}, Name={Name}, Amount={Amount}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}, ExpenseDate={ExpenseDate}",
                    expense.LandlordId, organizationId, expense.PropertyId, expense.Name, expense.Amount, expense.IsPaid, expense.PaidDate, expense.IsRecurring, expense.ExpenseDate);

                var expenseEntity = new Models.Expense
                {
                    LandlordId = expense.LandlordId,
                    OrganizationId = organizationId,
                    PropertyId = expense.PropertyId,
                    UnitId = expense.UnitId,
                    Name = expense.Name,
                    Category = expense.Category,
                    Amount = expense.Amount,
                    ExpenseDate = expense.ExpenseDate,
                    Vendor = expense.Vendor,
                    VendorId = expense.VendorId,
                    PaymentMethod = expense.PaymentMethod,
                    ReceiptUrl = expense.ReceiptUrl,
                    IsRecurring = expense.IsRecurring,
                    Frequency = expense.IsRecurring ? expense.Frequency : null,
                    DayOfPeriod = expense.IsRecurring ? expense.DayOfPeriod : null,
                    StartDate = expense.IsRecurring ? expense.StartDate : null,
                    EndDate = expense.IsRecurring ? expense.EndDate : null,
                    IsPaused = expense.IsRecurring ? expense.IsPaused : false,
                    IsTaxDeductible = expense.IsTaxDeductible,
                    TaxCategory = expense.TaxCategory,
                    IsLoanPayment = expense.IsLoanPayment,
                    LoanPrincipalAmount = expense.LoanPrincipalAmount,
                    LoanInterestAmount = expense.LoanInterestAmount,
                    LoanProvider = expense.LoanProvider,
                    MaintenanceRequestId = expense.MaintenanceRequestId,
                    IsPaid = expense.IsPaid,
                    PaidDate = expense.PaidDate,
                    BillDate = expense.BillDate,
                    DueDate = expense.DueDate,
                    BillNumber = expense.BillNumber,
                    CreatedAt = DateTime.Now
                };

                _logger.LogInformation("[ExpenseRepository] Created expense entity: IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}",
                    expenseEntity.IsPaid, expenseEntity.PaidDate, expenseEntity.IsRecurring);

                // Calculate next occurrence date for recurring expenses
                if (expense.IsRecurring && expense.Frequency.HasValue && expense.StartDate.HasValue && expense.DayOfPeriod.HasValue)
                {
                    expenseEntity.NextOccurrenceDate = Utils.RecurringExpenseCalculator.CalculateNextOccurrence(
                        expense.Frequency.Value,
                        expense.DayOfPeriod.Value,
                        expense.StartDate.Value,
                        null, // No last generated date yet
                        expense.EndDate);
                }

                await _context.Expenses.AddAsync(expenseEntity);
                await _context.SaveChangesAsync();
                _logger.LogInformation("[ExpenseRepository] Expense saved with Id={Id}, IsPaid={IsPaid}, PaidDate={PaidDate}",
                    expenseEntity.Id, expenseEntity.IsPaid, expenseEntity.PaidDate);

                // Load with includes for DTO mapping
                var savedExpense = await _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .FirstOrDefaultAsync(e => e.Id == expenseEntity.Id);

                if (savedExpense == null)
                {
                    _logger.LogError("[ExpenseRepository] Failed to retrieve saved expense with Id={Id}", expenseEntity.Id);
                    throw new Exception("Failed to retrieve saved expense");
                }

                _logger.LogInformation("[ExpenseRepository] Retrieved saved expense: Id={Id}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}",
                    savedExpense.Id, savedExpense.IsPaid, savedExpense.PaidDate, savedExpense.IsRecurring);

                var dto = _mapper.Map<LoadExpenseDto>(savedExpense);
                _logger.LogInformation("[ExpenseRepository] Mapped to DTO: Id={Id}, IsPaid={IsPaid}, PaidDate={PaidDate}",
                    dto.Id, dto.IsPaid, dto.PaidDate);
                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding expense");
                throw;
            }
        }

        public async Task<LoadExpenseDto> UpdateExpense(UpdateExpenseDto expense)
        {
            try
            {
                var expenseEntity = await _context.Expenses.FindAsync(expense.Id);
                if (expenseEntity == null)
                    throw new KeyNotFoundException($"Expense with ID {expense.Id} not found");

                expenseEntity.PropertyId = expense.PropertyId;
                expenseEntity.UnitId = expense.UnitId;
                expenseEntity.Name = expense.Name;
                expenseEntity.Category = expense.Category;
                expenseEntity.Amount = expense.Amount;
                expenseEntity.ExpenseDate = expense.ExpenseDate;
                expenseEntity.Vendor = expense.Vendor;
                expenseEntity.VendorId = expense.VendorId;
                expenseEntity.PaymentMethod = expense.PaymentMethod;
                expenseEntity.ReceiptUrl = expense.ReceiptUrl;
                expenseEntity.IsRecurring = expense.IsRecurring;
                expenseEntity.IsTaxDeductible = expense.IsTaxDeductible;
                expenseEntity.TaxCategory = expense.TaxCategory;
                expenseEntity.IsLoanPayment = expense.IsLoanPayment;
                expenseEntity.LoanPrincipalAmount = expense.LoanPrincipalAmount;
                expenseEntity.LoanInterestAmount = expense.LoanInterestAmount;
                expenseEntity.LoanProvider = expense.LoanProvider;
                expenseEntity.MaintenanceRequestId = expense.MaintenanceRequestId;

                // Handle recurring expense fields
                if (expense.IsRecurring)
                {
                    expenseEntity.Frequency = expense.Frequency;
                    expenseEntity.DayOfPeriod = expense.DayOfPeriod;
                    expenseEntity.StartDate = expense.StartDate;
                    expenseEntity.EndDate = expense.EndDate;
                    expenseEntity.IsPaused = expense.IsPaused;

                    // Recalculate next occurrence date if recurring fields changed
                    if (expense.Frequency.HasValue && expense.StartDate.HasValue && expense.DayOfPeriod.HasValue)
                    {
                        expenseEntity.NextOccurrenceDate = Utils.RecurringExpenseCalculator.CalculateNextOccurrence(
                            expense.Frequency.Value,
                            expense.DayOfPeriod.Value,
                            expense.StartDate.Value,
                            expenseEntity.LastGeneratedDate,
                            expense.EndDate);
                    }
                }
                else
                {
                    // Clear recurring fields for regular expenses
                    expenseEntity.Frequency = null;
                    expenseEntity.DayOfPeriod = null;
                    expenseEntity.StartDate = null;
                    expenseEntity.EndDate = null;
                    expenseEntity.LastGeneratedDate = null;
                    expenseEntity.NextOccurrenceDate = null;
                    expenseEntity.IsPaused = false;
                }

                // Update Accounts Payable fields
                expenseEntity.BillDate = expense.BillDate;
                expenseEntity.DueDate = expense.DueDate;
                expenseEntity.IsPaid = expense.IsPaid;
                expenseEntity.PaidDate = expense.PaidDate;
                expenseEntity.BillNumber = expense.BillNumber;

                expenseEntity.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();

                // Reload with includes
                await _context.Entry(expenseEntity).Reference(e => e.Property).LoadAsync();
                await _context.Entry(expenseEntity).Reference(e => e.Unit).LoadAsync();
                await _context.Entry(expenseEntity).Reference(e => e.VendorEntity).LoadAsync();

                return _mapper.Map<LoadExpenseDto>(expenseEntity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating expense {ExpenseId}", expense.Id);
                throw;
            }
        }

        public async Task<bool> DeleteExpense(long expenseId)
        {
            try
            {
                var expense = await _context.Expenses.FindAsync(expenseId);
                if (expense == null)
                    return false;

                _context.Expenses.Remove(expense);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expense {ExpenseId}", expenseId);
                throw;
            }
        }

        public async Task<LoadExpenseDto?> GetExpenseById(long expenseId)
        {
            try
            {
                var expense = await _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Include(e => e.Receipts)
                    .FirstOrDefaultAsync(e => e.Id == expenseId);

                return expense == null ? null : _mapper.Map<LoadExpenseDto>(expense);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense {ExpenseId}", expenseId);
                throw;
            }
        }

        public async Task<List<LoadExpenseDto>> GetExpensesByLandlordId(long landlordId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null, bool? isRecurring = null)
        {
            try
            {
                var query = _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Include(e => e.Receipts)
                    .Where(e => e.LandlordId == landlordId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                if (startDate.HasValue)
                    query = query.Where(e => e.ExpenseDate >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(e => e.ExpenseDate <= endDate.Value);

                if (!string.IsNullOrWhiteSpace(category))
                    query = query.Where(e => e.Category == category);

                if (vendorId.HasValue)
                    query = query.Where(e => e.VendorId == vendorId.Value);

                if (isRecurring.HasValue)
                    query = query.Where(e => e.IsRecurring == isRecurring.Value);

                var expenses = await query
                    .OrderByDescending(e => e.ExpenseDate)
                    .ThenByDescending(e => e.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadExpenseDto>>(expenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expenses for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<decimal> GetTotalExpensesByLandlordId(long landlordId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.Expenses
                    .Where(e => e.LandlordId == landlordId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                if (startDate.HasValue)
                    query = query.Where(e => e.ExpenseDate >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(e => e.ExpenseDate <= endDate.Value);

                return await query.SumAsync(e => e.Amount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating total expenses for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<List<LoadExpenseDto>> GetExpensesByOrganizationId(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null)
        {
            try
            {
                _logger.LogInformation("[ExpenseRepository] GetExpensesByOrganizationId called: OrganizationId={OrganizationId}, PropertyId={PropertyId}, StartDate={StartDate}, EndDate={EndDate}, Category={Category}",
                    organizationId, propertyId, startDate, endDate, category);

                var query = _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Include(e => e.Receipts)
                    .Where(e => e.OrganizationId == organizationId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                if (startDate.HasValue)
                    query = query.Where(e => e.ExpenseDate >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(e => e.ExpenseDate <= endDate.Value);

                if (!string.IsNullOrWhiteSpace(category))
                    query = query.Where(e => e.Category == category);

                if (vendorId.HasValue)
                    query = query.Where(e => e.VendorId == vendorId.Value);

                var expenses = await query
                    .OrderByDescending(e => e.ExpenseDate)
                    .ThenByDescending(e => e.CreatedAt)
                    .ToListAsync();

                _logger.LogInformation("[ExpenseRepository] Final expenses count: {Count}", expenses.Count);
                if (expenses.Count > 0)
                {
                    var sampleExpense = expenses[0];
                    _logger.LogInformation("[ExpenseRepository] Sample expense: Id={Id}, Name={Name}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}, ExpenseDate={ExpenseDate}, OrganizationId={OrganizationId}",
                        sampleExpense.Id, sampleExpense.Name, sampleExpense.IsPaid, sampleExpense.PaidDate, sampleExpense.IsRecurring, sampleExpense.ExpenseDate, sampleExpense.OrganizationId);
                }

                var dtos = _mapper.Map<List<LoadExpenseDto>>(expenses);
                _logger.LogInformation("[ExpenseRepository] Mapped to DTOs: {Count} expenses", dtos.Count);
                return dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ExpenseRepository] Error retrieving expenses for organization {OrganizationId}: {Message}", organizationId, ex.Message);
                throw;
            }
        }

        public async Task<decimal> GetTotalExpensesByOrganizationId(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null)
        {
            try
            {
                var query = _context.Expenses
                    .Where(e => e.OrganizationId == organizationId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                if (startDate.HasValue)
                    query = query.Where(e => e.ExpenseDate >= startDate.Value);

                if (endDate.HasValue)
                    query = query.Where(e => e.ExpenseDate <= endDate.Value);

                return await query.SumAsync(e => e.Amount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating total expenses for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadExpenseDto>> GetActiveRecurringExpensesDueToday()
        {
            try
            {
                var today = DateTime.Today;
                var activeRecurringExpenses = await _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Where(e => e.IsRecurring &&
                                !e.IsPaused &&
                                e.NextOccurrenceDate.HasValue &&
                                e.NextOccurrenceDate.Value.Date <= today &&
                                e.StartDate.HasValue &&
                                e.StartDate.Value.Date <= today &&
                                (!e.EndDate.HasValue || e.EndDate.Value.Date >= today))
                    .ToListAsync();

                return _mapper.Map<List<LoadExpenseDto>>(activeRecurringExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active recurring expenses due today");
                throw;
            }
        }

        public async Task UpdateRecurringExpenseDates(long expenseId, DateTime lastGeneratedDate, DateTime? nextOccurrenceDate)
        {
            try
            {
                var expense = await _context.Expenses.FindAsync(expenseId);
                if (expense != null)
                {
                    expense.LastGeneratedDate = lastGeneratedDate;
                    expense.NextOccurrenceDate = nextOccurrenceDate;
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating recurring expense dates for expense {ExpenseId}", expenseId);
                throw;
            }
        }

        public async Task<int> DeleteExpensesByPropertyId(long propertyId)
        {
            try
            {
                var expenses = await _context.Expenses
                    .Where(e => e.PropertyId == propertyId)
                    .ToListAsync();

                _context.Expenses.RemoveRange(expenses);
                await _context.SaveChangesAsync();

                return expenses.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expenses for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<LoadExpenseDto>> GetUnpaidBills(long organizationId, string? filter = null)
        {
            try
            {
                var today = DateTime.Today;
                var query = _context.Expenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Where(e => e.OrganizationId == organizationId && !e.IsPaid && !e.Property.IsDeleted)
                    .AsQueryable();

                // Apply filter
                if (!string.IsNullOrWhiteSpace(filter))
                {
                    switch (filter.ToLower())
                    {
                        case "overdue":
                            query = query.Where(e => e.DueDate.HasValue && e.DueDate.Value < today);
                            break;
                        case "duesoon":
                            var sevenDaysFromNow = today.AddDays(7);
                            query = query.Where(e => e.DueDate.HasValue && e.DueDate.Value >= today && e.DueDate.Value <= sevenDaysFromNow);
                            break;
                        // "all" or null shows all unpaid bills
                    }
                }

                var expenses = await query
                    .OrderBy(e => e.DueDate ?? DateTime.MaxValue)
                    .ThenBy(e => e.BillDate ?? DateTime.MaxValue)
                    .ToListAsync();

                return _mapper.Map<List<LoadExpenseDto>>(expenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unpaid bills for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<bool> MarkBillAsPaid(long expenseId, DateTime paidDate)
        {
            try
            {
                var expense = await _context.Expenses.FindAsync(expenseId);
                if (expense == null)
                {
                    return false;
                }

                expense.IsPaid = true;
                expense.PaidDate = paidDate;
                expense.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking bill as paid for expense {ExpenseId}", expenseId);
                throw;
            }
        }
    }
}

