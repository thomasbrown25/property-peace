using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Services.ExpenseReceiptService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.ExpenseReceipt;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Services.ExpenseCategorizationService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Utils;
using Microsoft.AspNetCore.Http;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using Azure.Storage.Blobs;

namespace brownstone_hub_api.Services.ExpenseService
{
    public class ExpenseService(
        IExpenseRepository expenseRepository,
        IExpenseReceiptService expenseReceiptService,
        IImageService<ExpenseReceipt, LoadImageDto, AddImageDto> imageService,
        IHttpContextAccessor httpContextAccessor,
        DataContext dataContext,
        IAccountMappingService accountMappingService,
        IGeneralLedgerService generalLedgerService,
        IExpenseCategorizationService expenseCategorizationService,
        IAzureBlobService azureBlobService,
        BlobServiceClient blobServiceClient,
        ILogger<ExpenseService> logger) : IExpenseService
    {
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IExpenseReceiptService _expenseReceiptService = expenseReceiptService;
        private readonly IImageService<ExpenseReceipt, LoadImageDto, AddImageDto> _imageService = imageService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly DataContext _dataContext = dataContext;
        private readonly IAccountMappingService _accountMappingService = accountMappingService;
        private readonly IGeneralLedgerService _generalLedgerService = generalLedgerService;
        private readonly IExpenseCategorizationService _expenseCategorizationService = expenseCategorizationService;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly ILogger<ExpenseService> _logger = logger;
        private const string EXPENSE_RECEIPTS_CONTAINER = "expense-receipts";

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadExpenseDto>> AddExpense(AddExpenseDto expense)
        {
            var response = new ServiceResponse<LoadExpenseDto>();
            try
            {
                _logger.LogInformation("[ExpenseService] AddExpense called: LandlordId={LandlordId}, PropertyId={PropertyId}, Name={Name}, Amount={Amount}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}", 
                    expense.LandlordId, expense.PropertyId, expense.Name, expense.Amount, expense.IsPaid, expense.PaidDate, expense.IsRecurring);
                
                var organizationId = GetOrganizationIdFromContext();
                _logger.LogInformation("[ExpenseService] OrganizationId from context: {OrganizationId}", organizationId);
                
                if (!organizationId.HasValue)
                {
                    _logger.LogWarning("[ExpenseService] OrganizationId is null");
                    response.Success = false;
                    response.Message = "Organization ID is required";
                    response.StatusCode = 400;
                    return response;
                }

                // Auto-categorize expense using AI if tax category is not already provided
                if (!expense.TaxCategory.HasValue || expense.TaxCategory == Enums.ETaxCategory.None)
                {
                    try
                    {
                        var categorizationResult = await _expenseCategorizationService.CategorizeExpenseAsync(
                            expense.Name,
                            expense.Amount,
                            expense.Vendor,
                            expense.Category);

                        if (categorizationResult.Success && categorizationResult.Data != null)
                        {
                            var categorization = categorizationResult.Data;
                            
                            // Set tax category and deductible flag
                            expense.TaxCategory = categorization.TaxCategory;
                            expense.IsTaxDeductible = categorization.IsTaxDeductible;

                            // Handle loan payment fields
                            if (categorization.IsLoanPayment)
                            {
                                expense.IsLoanPayment = true;
                                expense.LoanInterestAmount = categorization.LoanInterestAmount;
                                expense.LoanPrincipalAmount = categorization.LoanPrincipalAmount;
                                expense.LoanProvider = categorization.LoanProvider;
                            }

                            _logger.LogInformation(
                                "AI categorized expense '{Description}': TaxCategory={TaxCategory}, IsTaxDeductible={IsTaxDeductible}, IsLoanPayment={IsLoanPayment}",
                                expense.Name, expense.TaxCategory, expense.IsTaxDeductible, expense.IsLoanPayment);
                        }
                        else
                        {
                            _logger.LogWarning("AI categorization failed for expense '{Description}': {Message}",
                                expense.Name, categorizationResult.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        // Log but don't fail expense creation if AI categorization fails
                        _logger.LogError(ex, "Error during AI categorization for expense '{Description}'", expense.Name);
                    }
                }
                else
                {
                    // Tax category already provided, ensure IsTaxDeductible is set appropriately
                    if (expense.TaxCategory != Enums.ETaxCategory.Depreciation 
                        && expense.TaxCategory != Enums.ETaxCategory.Improvements)
                    {
                        expense.IsTaxDeductible = true;
                    }
                }

                var result = await _expenseRepository.AddExpense(expense, organizationId.Value);
                _logger.LogInformation("[ExpenseService] Expense created: Id={Id}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}", 
                    result?.Id, result?.IsPaid, result?.PaidDate, result?.IsRecurring);
                response.Data = result;

                // Create ledger entry for the expense
                if (result != null)
                {
                    try
                    {
                        var expenseAccount = await _accountMappingService.GetOrCreateExpenseAccountAsync(organizationId.Value, expense.Category);
                        if (expenseAccount != null)
                        {
                            // Expenses are negative (reduce equity)
                            var ledgerResponse = await _generalLedgerService.CreateLedgerEntryAsync(
                                organizationId.Value,
                                expenseAccount.Id,
                                result.Id,
                                "Expense",
                                -Math.Abs(expense.Amount), // Negative amount for expenses
                                expense.ExpenseDate,
                                expense.Name,
                                expense.BillNumber
                            );

                            if (!ledgerResponse.Success)
                            {
                                _logger.LogWarning("Failed to create ledger entry for expense {ExpenseId}: {Message}", result.Id, ledgerResponse.Message);
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Could not find or create expense account for category {Category}", expense.Category);
                        }
                    }
                    catch (Exception ledgerEx)
                    {
                        // Log but don't fail the expense creation if ledger entry fails
                        _logger.LogError(ledgerEx, "Error creating ledger entry for expense {ExpenseId}", result.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding expense");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadExpenseDto>> UpdateExpense(UpdateExpenseDto expense)
        {
            var response = new ServiceResponse<LoadExpenseDto>();
            try
            {
                var result = await _expenseRepository.UpdateExpense(expense);
                response.Data = result;
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Expense not found for update");
                response.Success = false;
                response.Message = "Expense not found";
                response.StatusCode = 404;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating expense");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteExpense(long expenseId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                var result = await _expenseRepository.DeleteExpense(expenseId);
                response.Data = result;
                if (!result)
                {
                    response.Success = false;
                    response.Message = "Expense not found";
                    response.StatusCode = 404;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expense {ExpenseId}", expenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadExpenseDto>> GetExpenseById(long expenseId)
        {
            var response = new ServiceResponse<LoadExpenseDto>();
            try
            {
                var result = await _expenseRepository.GetExpenseById(expenseId);
                if (result == null)
                {
                    response.Success = false;
                    response.Message = "Expense not found";
                    response.StatusCode = 404;
                }
                else
                {
                    // Load receipts for this expense using ImageService (same pattern as property images)
                    var receiptsResponse = await _imageService.GetImagesByRefId(expenseId);
                    if (receiptsResponse.Success && receiptsResponse.Data != null)
                    {
                        // Map LoadImageDto to LoadExpenseReceiptDto format
                        result.Receipts = receiptsResponse.Data.Select(r => new LoadExpenseReceiptDto
                        {
                            Id = r.Id,
                            ExpenseId = r.RefId,
                            BlobName = r.BlobName,
                            BlobUrl = r.BlobUrl,
                            CreatedAt = r.CreatedAt
                        }).ToList();
                    }
                    response.Data = result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense {ExpenseId}", expenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadExpenseDto>>> GetExpenses(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null)
        {
            var response = new ServiceResponse<List<LoadExpenseDto>>();
            try
            {
                _logger.LogInformation("[ExpenseService] GetExpenses called: OrganizationId={OrganizationId}, PropertyId={PropertyId}, StartDate={StartDate}, EndDate={EndDate}, Category={Category}", 
                    organizationId, propertyId, startDate, endDate, category);
                
                var result = await _expenseRepository.GetExpensesByOrganizationId(organizationId, propertyId, startDate, endDate, category);
                _logger.LogInformation("[ExpenseService] GetExpensesByOrganizationId returned {Count} expenses", result?.Count ?? 0);

                // OPTIMIZATION: Batch fetch all receipts in one query instead of N+1 queries
                if (result != null && result.Count > 0)
                {
                    var expenseIds = result.Select(e => e.Id).Distinct().ToList();
                    
                    // Batch fetch all receipts for all expenses in one query
                    var allReceipts = await _dataContext.ExpenseReceipts
                        .Where(r => expenseIds.Contains(r.RefId))
                        .ToListAsync();

                    // Group receipts by expense ID
                    var receiptsByExpenseId = allReceipts
                        .GroupBy(r => r.RefId)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    // Generate SAS URLs for all receipts in batch
                    var containerClient = _blobServiceClient.GetBlobContainerClient(EXPENSE_RECEIPTS_CONTAINER);
                    
                    // Map receipts to expenses with SAS URLs
                    foreach (var expense in result)
                    {
                        if (receiptsByExpenseId.TryGetValue(expense.Id, out var receipts))
                        {
                            expense.Receipts = receipts.Select(r =>
                            {
                                var receiptDto = new LoadExpenseReceiptDto
                                {
                                    Id = r.Id,
                                    ExpenseId = r.RefId,
                                    BlobName = r.BlobName,
                                    BlobUrl = r.BlobUrl,
                                    CreatedAt = r.CreatedAt
                                };

                                // Generate fresh SAS URL for each receipt
                                if (!string.IsNullOrEmpty(r.BlobName))
                                {
                                    try
                                    {
                                        var blobClient = containerClient.GetBlobClient(r.BlobName);
                                        var sasUri = _azureBlobService.GenerateBlobSasUri(
                                            _blobServiceClient,
                                            blobClient,
                                            TimeSpan.FromHours(1)
                                        );
                                        receiptDto.BlobUrl = sasUri;
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogWarning(ex, "Failed to generate SAS URL for receipt {ReceiptId} with blob {BlobName}", r.Id, r.BlobName);
                                        // Keep original BlobUrl if SAS generation fails
                                    }
                                }

                                return receiptDto;
                            }).ToList();
                        }
                        else
                        {
                            expense.Receipts = new List<LoadExpenseReceiptDto>();
                        }
                    }
                }

                _logger.LogInformation("[ExpenseService] Returning {Count} expenses after loading receipts", result?.Count ?? 0);
                if (result != null && result.Count > 0)
                {
                    var sampleExpense = result[0];
                    _logger.LogInformation("[ExpenseService] Sample expense: Id={Id}, Name={Name}, IsPaid={IsPaid}, PaidDate={PaidDate}, IsRecurring={IsRecurring}, ExpenseDate={ExpenseDate}", 
                        sampleExpense.Id, sampleExpense.Name, sampleExpense.IsPaid, sampleExpense.PaidDate, sampleExpense.IsRecurring, sampleExpense.ExpenseDate);
                }

                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ExpenseService] Error retrieving expenses for organization {OrganizationId}: {Message}", organizationId, ex.Message);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<decimal>> GetTotalExpenses(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null)
        {
            var response = new ServiceResponse<decimal>();
            try
            {
                var result = await _expenseRepository.GetTotalExpensesByOrganizationId(organizationId, propertyId, startDate, endDate);
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating total expenses for organizationId {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> GenerateExpensesFromRecurring()
        {
            var response = new ServiceResponse<bool>();
            try
            {
                _logger.LogInformation("Starting generation of expenses from recurring expenses.");
                var recurringExpensesDue = await _expenseRepository.GetActiveRecurringExpensesDueToday();
                int generatedCount = 0;

                foreach (var recurringExpense in recurringExpensesDue)
                {
                    try
                    {
                        // Create a new expense based on the recurring expense
                        var newExpense = new AddExpenseDto
                        {
                            LandlordId = recurringExpense.LandlordId,
                            PropertyId = recurringExpense.PropertyId,
                            UnitId = recurringExpense.UnitId,
                            Name = recurringExpense.Name,
                            Category = recurringExpense.Category,
                            Amount = recurringExpense.Amount,
                            ExpenseDate = DateTime.Today, // Expense date is today
                            Vendor = recurringExpense.Vendor,
                            PaymentMethod = null, // Payment method not set for generated expenses
                            ReceiptUrl = null,
                            IsRecurring = false, // Generated expenses are not recurring themselves
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

                        await _expenseRepository.AddExpense(newExpense, property.OrganizationId.Value);

                        // Update the LastGeneratedDate and NextOccurrenceDate of the recurring expense
                        // Calculate next occurrence
                        var nextOccurrence = RecurringExpenseCalculator.CalculateNextOccurrence(
                            recurringExpense.Frequency!.Value,
                            recurringExpense.DayOfPeriod!.Value,
                            recurringExpense.StartDate!.Value,
                            DateTime.Today, // Last generated date is now today
                            recurringExpense.EndDate);

                        // Update the recurring expense template
                        var updateDto = new UpdateExpenseDto
                        {
                            Id = recurringExpense.Id,
                            PropertyId = recurringExpense.PropertyId,
                            UnitId = recurringExpense.UnitId,
                            Name = recurringExpense.Name,
                            Category = recurringExpense.Category,
                            Amount = recurringExpense.Amount,
                            ExpenseDate = recurringExpense.ExpenseDate,
                            Vendor = recurringExpense.Vendor,
                            PaymentMethod = recurringExpense.PaymentMethod,
                            ReceiptUrl = recurringExpense.ReceiptUrl,
                            IsRecurring = true,
                            Frequency = recurringExpense.Frequency,
                            DayOfPeriod = recurringExpense.DayOfPeriod,
                            StartDate = recurringExpense.StartDate,
                            EndDate = recurringExpense.EndDate,
                            IsPaused = recurringExpense.IsPaused,
                            IsTaxDeductible = recurringExpense.IsTaxDeductible,
                            MaintenanceRequestId = recurringExpense.MaintenanceRequestId
                        };

                        await _expenseRepository.UpdateExpense(updateDto);

                        // Update LastGeneratedDate directly in the database
                        await _expenseRepository.UpdateRecurringExpenseDates(recurringExpense.Id, DateTime.Today, nextOccurrence);

                        generatedCount++;
                        _logger.LogInformation("Generated expense for recurring expense ID {RecurringExpenseId}", recurringExpense.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to generate expense for recurring expense ID {RecurringExpenseId}", recurringExpense.Id);
                    }
                }

                _logger.LogInformation("Finished generating expenses. Total generated: {GeneratedCount}", generatedCount);
                response.Data = true;
                response.Message = $"Generated {generatedCount} expenses from recurring expenses.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GenerateExpensesFromRecurring");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadExpenseDto>> PauseRecurringExpense(long expenseId)
        {
            var response = new ServiceResponse<LoadExpenseDto>();
            try
            {
                var expense = await _expenseRepository.GetExpenseById(expenseId);
                if (expense == null || !expense.IsRecurring)
                {
                    response.Success = false;
                    response.Message = "Expense not found or is not a recurring expense";
                    response.StatusCode = 404;
                    return response;
                }

                var updateDto = new UpdateExpenseDto
                {
                    Id = expense.Id,
                    PropertyId = expense.PropertyId,
                    UnitId = expense.UnitId,
                    Name = expense.Name,
                    Category = expense.Category,
                    Amount = expense.Amount,
                    ExpenseDate = expense.ExpenseDate,
                    Vendor = expense.Vendor,
                    PaymentMethod = expense.PaymentMethod,
                    ReceiptUrl = expense.ReceiptUrl,
                    IsRecurring = true,
                    Frequency = expense.Frequency,
                    DayOfPeriod = expense.DayOfPeriod,
                    StartDate = expense.StartDate,
                    EndDate = expense.EndDate,
                    IsPaused = true,
                    IsTaxDeductible = expense.IsTaxDeductible,
                    MaintenanceRequestId = expense.MaintenanceRequestId
                };

                var result = await _expenseRepository.UpdateExpense(updateDto);
                response.Data = result;
                response.Message = "Recurring expense paused successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing recurring expense {ExpenseId}", expenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<LoadExpenseDto>> ResumeRecurringExpense(long expenseId)
        {
            var response = new ServiceResponse<LoadExpenseDto>();
            try
            {
                var expense = await _expenseRepository.GetExpenseById(expenseId);
                if (expense == null || !expense.IsRecurring)
                {
                    response.Success = false;
                    response.Message = "Expense not found or is not a recurring expense";
                    response.StatusCode = 404;
                    return response;
                }

                var updateDto = new UpdateExpenseDto
                {
                    Id = expense.Id,
                    PropertyId = expense.PropertyId,
                    UnitId = expense.UnitId,
                    Name = expense.Name,
                    Category = expense.Category,
                    Amount = expense.Amount,
                    ExpenseDate = expense.ExpenseDate,
                    Vendor = expense.Vendor,
                    PaymentMethod = expense.PaymentMethod,
                    ReceiptUrl = expense.ReceiptUrl,
                    IsRecurring = true,
                    Frequency = expense.Frequency,
                    DayOfPeriod = expense.DayOfPeriod,
                    StartDate = expense.StartDate,
                    EndDate = expense.EndDate,
                    IsPaused = false,
                    IsTaxDeductible = expense.IsTaxDeductible,
                    MaintenanceRequestId = expense.MaintenanceRequestId
                };

                var result = await _expenseRepository.UpdateExpense(updateDto);
                response.Data = result;
                response.Message = "Recurring expense resumed successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming recurring expense {ExpenseId}", expenseId);
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadExpenseDto>>> GetUnpaidBillsAsync(string? filter = null)
        {
            var response = new ServiceResponse<List<LoadExpenseDto>>();
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

                var bills = await _expenseRepository.GetUnpaidBills(organizationId.Value, filter);
                response.Data = bills;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unpaid bills");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> MarkBillAsPaidAsync(long expenseId, DateTime paidDate)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                var result = await _expenseRepository.MarkBillAsPaid(expenseId, paidDate);
                if (!result)
                {
                    response.Success = false;
                    response.Message = "Expense not found";
                    response.StatusCode = 404;
                    return response;
                }
                response.Data = result;
                response.Message = "Bill marked as paid successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking bill as paid");
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}

