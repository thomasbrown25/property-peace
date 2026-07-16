using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Tax;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;
using System.Text;

namespace brownstone_hub_api.Services.TaxReportService
{
    public class TaxReportService(
        IExpenseRepository expenseRepository,
        IPaymentRepository paymentRepository,
        ILogger<TaxReportService> logger) : ITaxReportService
    {
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly ILogger<TaxReportService> _logger = logger;

        public async Task<ServiceResponse<TaxYearReportDto>> GetTaxYearReport(long landlordId, int year)
        {
            try
            {
                var (startDate, endDate) = GetYearRange(year);
                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, startDate, endDate, null);
                var deductibleExpenses = expenses.Where(e => e.IsTaxDeductible).ToList();

                var payments = await GetYearPayments(landlordId, startDate, endDate);
                var rentPayments = payments.Where(IsRentIncomePayment).ToList();
                var feePayments = payments.Where(IsFeeIncomePayment).ToList();
                var depositPayments = payments.Where(p => p.DepositId.HasValue).ToList();

                var totalIncome = rentPayments.Sum(p => p.Amount) + feePayments.Sum(p => p.Amount);
                var totalExpenses = deductibleExpenses.Sum(GetDeductibleAmount);
                var netIncome = totalIncome - totalExpenses;

                var categorySummaries = deductibleExpenses
                    .GroupBy(e => e.TaxCategory ?? ETaxCategory.None)
                    .Select(g => new TaxCategorySummaryDto
                    {
                        TaxCategory = g.Key,
                        CategoryName = GetTaxCategoryName(g.Key),
                        TotalAmount = g.Sum(GetDeductibleAmount),
                        ExpenseCount = g.Count(),
                        IsFullyDeductible = IsCategoryFullyDeductible(g.Key)
                    })
                    .OrderByDescending(c => c.TotalAmount)
                    .ToList();

                var report = new TaxYearReportDto
                {
                    Year = year,
                    TotalIncome = totalIncome,
                    RentIncome = rentPayments.Sum(p => p.Amount),
                    FeeIncome = feePayments.Sum(p => p.Amount),
                    DepositIncome = 0,
                    DepositsNeedingReview = depositPayments.Sum(p => p.Amount),
                    TotalExpenses = totalExpenses,
                    NetIncome = netIncome,
                    CategorySummaries = categorySummaries,
                    DeductibleExpenses = deductibleExpenses.Select(ToTaxDeductibleExpenseDto).ToList(),
                    StartDate = startDate,
                    EndDate = endDate
                };

                return new ServiceResponse<TaxYearReportDto> { Data = report };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax year report");
                return ServiceResponse<TaxYearReportDto>.CreateError("Error retrieving tax year report", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<TaxCategorySummaryDto>>> GetTaxCategorySummary(long landlordId, int? year = null)
        {
            try
            {
                DateTime? startDate = null;
                DateTime? endDate = null;

                if (year.HasValue)
                {
                    (startDate, endDate) = GetYearRange(year.Value);
                }

                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, startDate, endDate, null);
                var deductibleExpenses = expenses.Where(e => e.IsTaxDeductible).ToList();

                var summaries = deductibleExpenses
                    .GroupBy(e => e.TaxCategory ?? ETaxCategory.None)
                    .Select(g => new TaxCategorySummaryDto
                    {
                        TaxCategory = g.Key,
                        CategoryName = GetTaxCategoryName(g.Key),
                        TotalAmount = g.Sum(GetDeductibleAmount),
                        ExpenseCount = g.Count(),
                        IsFullyDeductible = IsCategoryFullyDeductible(g.Key)
                    })
                    .OrderByDescending(c => c.TotalAmount)
                    .ToList();

                return new ServiceResponse<List<TaxCategorySummaryDto>> { Data = summaries };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax category summary");
                return ServiceResponse<List<TaxCategorySummaryDto>>.CreateError("Error retrieving tax category summary", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<TaxDeductibleExpenseDto>>> GetTaxDeductibleExpenses(
            long landlordId,
            int? year = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var actualStartDate = startDate;
                var actualEndDate = endDate;

                if (year.HasValue && !startDate.HasValue)
                {
                    (actualStartDate, actualEndDate) = GetYearRange(year.Value);
                }

                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, actualStartDate, actualEndDate, null);
                var expenseDtos = expenses
                    .Where(e => e.IsTaxDeductible)
                    .Select(ToTaxDeductibleExpenseDto)
                    .OrderByDescending(e => e.ExpenseDate)
                    .ToList();

                return new ServiceResponse<List<TaxDeductibleExpenseDto>> { Data = expenseDtos };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax deductible expenses");
                return ServiceResponse<List<TaxDeductibleExpenseDto>>.CreateError("Error retrieving tax deductible expenses", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<Form1099Dto>>> GetForm1099Data(long landlordId, int year)
        {
            try
            {
                var (startDate, endDate) = GetYearRange(year);
                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, startDate, endDate, null);
                var eligibleExpenses = expenses.Where(IsPotential1099Expense).ToList();

                var form1099Data = eligibleExpenses
                    .GroupBy(e => new
                    {
                        e.VendorId,
                        VendorName = GetVendorName(e),
                        e.VendorTaxId,
                        e.VendorAddress,
                        e.VendorRequires1099
                    })
                    .Select(g => new Form1099Dto
                    {
                        Year = year,
                        VendorId = g.Key.VendorId,
                        VendorName = g.Key.VendorName,
                        VendorTaxId = g.Key.VendorTaxId,
                        VendorAddress = g.Key.VendorAddress,
                        Requires1099 = g.Key.VendorRequires1099,
                        MissingTaxId = string.IsNullOrWhiteSpace(g.Key.VendorTaxId),
                        MissingAddress = string.IsNullOrWhiteSpace(g.Key.VendorAddress),
                        TotalAmount = g.Sum(GetDeductibleAmount),
                        ExpenseCount = g.Count(),
                        Expenses = g.Select(e => new Form1099ExpenseDto
                        {
                            ExpenseId = e.Id,
                            Description = e.Name,
                            Amount = GetDeductibleAmount(e),
                            ExpenseDate = e.ExpenseDate,
                            PropertyName = e.PropertyName ?? "Unknown"
                        }).OrderBy(e => e.ExpenseDate).ToList()
                    })
                    .Where(f => f.TotalAmount >= 600)
                    .OrderBy(f => f.VendorName)
                    .ToList();

                return new ServiceResponse<List<Form1099Dto>> { Data = form1099Data };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving 1099 data");
                return ServiceResponse<List<Form1099Dto>>.CreateError("Error retrieving 1099 data", ex.Message);
            }
        }

        public async Task<ServiceResponse<TaxReadinessDto>> GetTaxReadiness(long landlordId, int year)
        {
            try
            {
                var (startDate, endDate) = GetYearRange(year);
                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, startDate, endDate, null);
                var payments = await GetYearPayments(landlordId, startDate, endDate);
                var form1099 = (await GetForm1099Data(landlordId, year)).Data ?? [];

                var deductibleExpenses = expenses.Where(e => e.IsTaxDeductible).ToList();
                var expenseReviewQueue = expenses
                    .Select(ToTaxReviewExpenseDto)
                    .Where(e => e.Issues.Count > 0)
                    .OrderByDescending(e => e.ExpenseDate)
                    .ToList();

                var depositsNeedingReview = payments
                    .Where(p => p.DepositId.HasValue)
                    .Select(p => new TaxDepositReviewDto
                    {
                        PaymentId = p.Id,
                        DepositId = p.DepositId,
                        PropertyId = p.PropertyId,
                        PropertyName = p.PropertyName,
                        UnitName = p.UnitName,
                        Amount = p.Amount,
                        PaymentDate = p.PaymentDate,
                        TenantName = p.TenantName
                    })
                    .OrderByDescending(p => p.PaymentDate)
                    .ToList();

                var propertyPackages = BuildPropertyPackages(expenses, payments, expenseReviewQueue);

                var missingCategoryCount = deductibleExpenses.Count(e => !e.TaxCategory.HasValue || e.TaxCategory == ETaxCategory.None);
                var missingReceiptCount = deductibleExpenses.Count(e => !HasReceipt(e));
                var loanSplitIssueCount = deductibleExpenses.Count(HasLoanSplitIssue);
                var vendorMissingInfoCount = form1099.Count(v => v.NeedsW9Info);

                var actionCount = missingCategoryCount + loanSplitIssueCount + depositsNeedingReview.Count + vendorMissingInfoCount;
                var warningCount = missingReceiptCount;
                var totalChecks = Math.Max(1, deductibleExpenses.Count + depositsNeedingReview.Count + form1099.Count);
                var score = Math.Max(0, Math.Min(100, 100 - (int)Math.Round(((actionCount * 1.0m) + (warningCount * 0.5m)) / totalChecks * 100)));

                var readiness = new TaxReadinessDto
                {
                    Year = year,
                    OverallScore = score,
                    TotalExpenseCount = expenses.Count,
                    DeductibleExpenseCount = deductibleExpenses.Count,
                    CategorizedDeductibleExpenseCount = deductibleExpenses.Count - missingCategoryCount,
                    MissingCategoryCount = missingCategoryCount,
                    MissingReceiptCount = missingReceiptCount,
                    LoanSplitIssueCount = loanSplitIssueCount,
                    DepositReviewCount = depositsNeedingReview.Count,
                    Vendor1099Count = form1099.Count,
                    Vendor1099MissingInfoCount = vendorMissingInfoCount,
                    PropertyPackageCount = propertyPackages.Count,
                    IsReadyForAccountant = actionCount == 0,
                    ExpenseReviewQueue = expenseReviewQueue,
                    DepositReviewQueue = depositsNeedingReview,
                    PropertyPackages = propertyPackages,
                    Items =
                    [
                        BuildReadinessItem("categories", "Expenses categorized", missingCategoryCount, missingCategoryCount == 0 ? "ready" : "action", missingCategoryCount == 0 ? "All deductible expenses have a Schedule E category." : "Deductible expenses need Schedule E categories before export."),
                        BuildReadinessItem("receipts", "Receipts attached", missingReceiptCount, missingReceiptCount == 0 ? "ready" : "warning", missingReceiptCount == 0 ? "Deductible expenses have receipt support." : "Deductible expenses are missing receipt attachments."),
                        BuildReadinessItem("loans", "Mortgage/loan splits", loanSplitIssueCount, loanSplitIssueCount == 0 ? "ready" : "action", loanSplitIssueCount == 0 ? "Loan payments have interest amounts for deductible reporting." : "Loan payments need interest/principal split review."),
                        BuildReadinessItem("deposits", "Deposits classified", depositsNeedingReview.Count, depositsNeedingReview.Count == 0 ? "ready" : "action", depositsNeedingReview.Count == 0 ? "No deposit payments need tax classification." : "Deposit payments should be classified as held, refunded, applied, or forfeited."),
                        BuildReadinessItem("vendors", "1099 vendor info", vendorMissingInfoCount, vendorMissingInfoCount == 0 ? "ready" : "action", vendorMissingInfoCount == 0 ? "1099 vendors have tax ID and address details." : "1099 vendors are missing W-9/TIN/address information."),
                        BuildReadinessItem("properties", "Per-property package", propertyPackages.Count, "ready", "Income and deductions are grouped into accountant-friendly property packages.")
                    ]
                };

                return new ServiceResponse<TaxReadinessDto> { Data = readiness };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tax readiness");
                return ServiceResponse<TaxReadinessDto>.CreateError("Error retrieving tax readiness", ex.Message);
            }
        }

        public async Task<ServiceResponse<AccountingExportDto>> ExportToAccountingSoftware(
            long landlordId,
            string format,
            int? year = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var actualStartDate = startDate;
                var actualEndDate = endDate;

                if (year.HasValue && !startDate.HasValue)
                {
                    (actualStartDate, actualEndDate) = GetYearRange(year.Value);
                }

                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, null, actualStartDate, actualEndDate, null);
                var payments = await _paymentRepository.GetLifetimePaymentsByLandlordId(landlordId);

                if (actualStartDate.HasValue)
                    payments = payments.Where(p => p.PaymentDate >= actualStartDate.Value).ToList();
                if (actualEndDate.HasValue)
                    payments = payments.Where(p => p.PaymentDate <= actualEndDate.Value).ToList();

                var incomePayments = payments.Where(IsTaxableIncomePayment).ToList();
                var taxYear = year ?? DateTime.Now.Year;
                string fileContent;
                string fileName;
                string mimeType = "text/csv";

                switch (format.ToLower())
                {
                    case "quickbooks":
                    case "qb":
                        fileContent = GenerateQuickBooksFormat(expenses, incomePayments);
                        fileName = $"quickbooks-export-{taxYear}.iif";
                        mimeType = "application/x-iif";
                        break;
                    case "xero":
                        fileContent = GenerateXeroFormat(expenses, incomePayments);
                        fileName = $"xero-export-{taxYear}.csv";
                        break;
                    case "accountant":
                    case "package":
                        var readiness = (await GetTaxReadiness(landlordId, taxYear)).Data;
                        fileContent = GenerateAccountantPackageSummary(expenses, incomePayments, readiness, taxYear);
                        fileName = $"accountant-tax-package-{taxYear}.csv";
                        break;
                    case "csv":
                    default:
                        fileContent = GenerateCSVFormat(expenses, incomePayments);
                        fileName = $"accounting-export-{taxYear}.csv";
                        break;
                }

                var export = new AccountingExportDto
                {
                    Format = format,
                    Year = taxYear,
                    StartDate = actualStartDate,
                    EndDate = actualEndDate,
                    FileContent = fileContent,
                    FileName = fileName,
                    MimeType = mimeType
                };

                return new ServiceResponse<AccountingExportDto> { Data = export };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting to accounting software");
                return ServiceResponse<AccountingExportDto>.CreateError("Error exporting to accounting software", ex.Message);
            }
        }

        private async Task<List<LoadPaymentDto>> GetYearPayments(long landlordId, DateTime startDate, DateTime endDate)
        {
            var payments = await _paymentRepository.GetLifetimePaymentsByLandlordId(landlordId);
            return payments.Where(p => p.PaymentDate >= startDate && p.PaymentDate <= endDate && IsCompletedPayment(p)).ToList();
        }

        private static (DateTime StartDate, DateTime EndDate) GetYearRange(int year)
        {
            return (new DateTime(year, 1, 1), new DateTime(year, 12, 31, 23, 59, 59));
        }

        private static bool IsCompletedPayment(LoadPaymentDto payment)
        {
            var status = payment.Status?.Trim().ToLowerInvariant();
            return string.IsNullOrEmpty(status) || status is "completed" or "paid" or "succeeded" or "success";
        }

        private static bool IsRentIncomePayment(LoadPaymentDto payment) => !payment.DepositId.HasValue && !payment.FeeId.HasValue;

        private static bool IsFeeIncomePayment(LoadPaymentDto payment) => !payment.DepositId.HasValue && payment.FeeId.HasValue;

        private static bool IsTaxableIncomePayment(LoadPaymentDto payment) => IsCompletedPayment(payment) && !payment.DepositId.HasValue;

        private static decimal GetDeductibleAmount(LoadExpenseDto expense)
        {
            if (!expense.IsTaxDeductible)
                return 0;

            if (expense.IsLoanPayment)
                return expense.LoanInterestAmount ?? 0;

            if (expense.TaxCategory is ETaxCategory.Improvements or ETaxCategory.Depreciation)
                return 0;

            return expense.Amount;
        }

        private static bool HasReceipt(LoadExpenseDto expense)
        {
            return !string.IsNullOrWhiteSpace(expense.ReceiptUrl) || expense.Receipts.Any();
        }

        private static bool HasLoanSplitIssue(LoadExpenseDto expense)
        {
            return expense.IsLoanPayment && (!expense.LoanInterestAmount.HasValue || expense.LoanInterestAmount.Value <= 0);
        }

        private static bool IsPotential1099Expense(LoadExpenseDto expense)
        {
            if (!expense.IsTaxDeductible || string.IsNullOrWhiteSpace(GetVendorName(expense)))
                return false;

            return expense.VendorRequires1099 || expense.TaxCategory is ETaxCategory.ContractLabor or ETaxCategory.Services or ETaxCategory.ProfessionalServices;
        }

        private static TaxDeductibleExpenseDto ToTaxDeductibleExpenseDto(LoadExpenseDto expense)
        {
            var reasons = BuildExpenseReviewReasons(expense);
            return new TaxDeductibleExpenseDto
            {
                ExpenseId = expense.Id,
                PropertyId = expense.PropertyId,
                PropertyName = expense.PropertyName ?? "Unknown",
                UnitName = expense.UnitName,
                Description = expense.Name,
                Amount = expense.Amount,
                DeductibleAmount = GetDeductibleAmount(expense),
                ExpenseDate = expense.ExpenseDate,
                TaxCategory = expense.TaxCategory,
                TaxCategoryName = expense.TaxCategory.HasValue ? GetTaxCategoryName(expense.TaxCategory.Value) : null,
                Vendor = GetVendorName(expense),
                PaymentMethod = expense.PaymentMethod,
                IsFullyDeductible = expense.TaxCategory.HasValue && IsCategoryFullyDeductible(expense.TaxCategory.Value) && !expense.IsLoanPayment,
                IsLoanPayment = expense.IsLoanPayment,
                LoanPrincipalAmount = expense.LoanPrincipalAmount,
                LoanInterestAmount = expense.LoanInterestAmount,
                HasReceipt = HasReceipt(expense),
                NeedsReview = reasons.Count > 0,
                ReviewReasons = reasons
            };
        }

        private static TaxReviewExpenseDto ToTaxReviewExpenseDto(LoadExpenseDto expense)
        {
            return new TaxReviewExpenseDto
            {
                ExpenseId = expense.Id,
                PropertyId = expense.PropertyId,
                PropertyName = expense.PropertyName ?? "Unknown",
                UnitName = expense.UnitName,
                Description = expense.Name,
                Amount = expense.Amount,
                DeductibleAmount = GetDeductibleAmount(expense),
                ExpenseDate = expense.ExpenseDate,
                TaxCategory = expense.TaxCategory,
                TaxCategoryName = expense.TaxCategory.HasValue ? GetTaxCategoryName(expense.TaxCategory.Value) : null,
                Vendor = GetVendorName(expense),
                IsTaxDeductible = expense.IsTaxDeductible,
                IsLoanPayment = expense.IsLoanPayment,
                HasReceipt = HasReceipt(expense),
                Issues = BuildExpenseReviewReasons(expense)
            };
        }

        private static List<string> BuildExpenseReviewReasons(LoadExpenseDto expense)
        {
            var reasons = new List<string>();

            if (expense.IsTaxDeductible && (!expense.TaxCategory.HasValue || expense.TaxCategory == ETaxCategory.None))
                reasons.Add("Missing Schedule E tax category");

            if (expense.IsTaxDeductible && !HasReceipt(expense))
                reasons.Add("Missing receipt");

            if (HasLoanSplitIssue(expense))
                reasons.Add("Loan payment needs interest/principal split");

            if (expense.IsTaxDeductible && expense.TaxCategory is ETaxCategory.Improvements or ETaxCategory.Depreciation)
                reasons.Add("Capital/depreciation item should be reviewed with accountant");

            return reasons;
        }

        private static List<TaxPropertyPackageDto> BuildPropertyPackages(
            List<LoadExpenseDto> expenses,
            List<LoadPaymentDto> payments,
            List<TaxReviewExpenseDto> reviewQueue)
        {
            var propertyIds = expenses.Select(e => e.PropertyId)
                .Concat(payments.Select(p => p.PropertyId))
                .Distinct()
                .ToList();

            return propertyIds.Select(propertyId =>
            {
                var propertyExpenses = expenses.Where(e => e.PropertyId == propertyId).ToList();
                var propertyPayments = payments.Where(p => p.PropertyId == propertyId && IsTaxableIncomePayment(p)).ToList();
                var propertyName = propertyExpenses.FirstOrDefault()?.PropertyName ?? propertyPayments.FirstOrDefault()?.PropertyName ?? "Unknown";

                var income = propertyPayments.Sum(p => p.Amount);
                var deductible = propertyExpenses.Where(e => e.IsTaxDeductible).Sum(GetDeductibleAmount);

                return new TaxPropertyPackageDto
                {
                    PropertyId = propertyId,
                    PropertyName = propertyName,
                    Income = income,
                    DeductibleExpenses = deductible,
                    NetIncome = income - deductible,
                    ExpenseCount = propertyExpenses.Count,
                    MissingReceiptCount = propertyExpenses.Count(e => e.IsTaxDeductible && !HasReceipt(e)),
                    ReviewItemCount = reviewQueue.Count(e => e.PropertyId == propertyId)
                };
            })
            .OrderBy(p => p.PropertyName)
            .ToList();
        }

        private static TaxReadinessItemDto BuildReadinessItem(string key, string label, int count, string status, string description)
        {
            return new TaxReadinessItemDto
            {
                Key = key,
                Label = label,
                Count = count,
                Status = status,
                Description = description
            };
        }

        private static string GetVendorName(LoadExpenseDto expense)
        {
            return expense.VendorName ?? expense.Vendor ?? string.Empty;
        }

        private static string GetTaxCategoryName(ETaxCategory category)
        {
            return category switch
            {
                ETaxCategory.Repairs => "Repairs",
                ETaxCategory.Maintenance => "Maintenance",
                ETaxCategory.Cleaning => "Cleaning",
                ETaxCategory.Landscaping => "Landscaping",
                ETaxCategory.Utilities => "Utilities",
                ETaxCategory.Water => "Water",
                ETaxCategory.Sewer => "Sewer",
                ETaxCategory.Garbage => "Garbage",
                ETaxCategory.Internet => "Internet",
                ETaxCategory.Phone => "Phone",
                ETaxCategory.Insurance => "Insurance",
                ETaxCategory.LiabilityInsurance => "Liability Insurance",
                ETaxCategory.PropertyInsurance => "Property Insurance",
                ETaxCategory.PropertyTaxes => "Property Taxes",
                ETaxCategory.LocalTaxes => "Local Taxes",
                ETaxCategory.StateTaxes => "State Taxes",
                ETaxCategory.PropertyManagement => "Property Management",
                ETaxCategory.LegalFees => "Legal Fees",
                ETaxCategory.AccountingFees => "Accounting Fees",
                ETaxCategory.ProfessionalServices => "Professional Services",
                ETaxCategory.Advertising => "Advertising",
                ETaxCategory.Marketing => "Marketing",
                ETaxCategory.Travel => "Travel",
                ETaxCategory.Transportation => "Transportation",
                ETaxCategory.VehicleExpenses => "Vehicle Expenses",
                ETaxCategory.Depreciation => "Depreciation",
                ETaxCategory.Improvements => "Improvements",
                ETaxCategory.Other => "Other",
                ETaxCategory.Supplies => "Supplies",
                ETaxCategory.OfficeExpenses => "Office Expenses",
                ETaxCategory.BankFees => "Bank Fees",
                ETaxCategory.Interest => "Interest",
                ETaxCategory.MortgageInterest => "Mortgage Interest",
                ETaxCategory.ContractLabor => "Contract Labor",
                ETaxCategory.Services => "Services",
                _ => "Uncategorized"
            };
        }

        private static bool IsCategoryFullyDeductible(ETaxCategory category)
        {
            return category != ETaxCategory.Depreciation && category != ETaxCategory.Improvements;
        }

        private static string GenerateCSVFormat(List<LoadExpenseDto> expenses, List<LoadPaymentDto> payments)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Date,Type,Description,Amount,Deductible Amount,Category,Property,Vendor,Payment Method,Review Notes");

            foreach (var expense in expenses.OrderBy(e => e.ExpenseDate))
            {
                var reviewNotes = string.Join("; ", BuildExpenseReviewReasons(expense));
                sb.AppendLine(string.Join(',',
                    Csv(expense.ExpenseDate.ToString("yyyy-MM-dd")),
                    Csv("Expense"),
                    Csv(expense.Name),
                    expense.Amount.ToString("F2"),
                    GetDeductibleAmount(expense).ToString("F2"),
                    Csv(expense.TaxCategory.HasValue ? GetTaxCategoryName(expense.TaxCategory.Value) : expense.Category),
                    Csv(expense.PropertyName ?? ""),
                    Csv(GetVendorName(expense)),
                    Csv(expense.PaymentMethod ?? ""),
                    Csv(reviewNotes)));
            }

            foreach (var payment in payments.OrderBy(p => p.PaymentDate))
            {
                sb.AppendLine(string.Join(',',
                    Csv(payment.PaymentDate.ToString("yyyy-MM-dd")),
                    Csv("Income"),
                    Csv(payment.FeeId.HasValue ? payment.FeeName ?? "Fee payment" : "Rent payment"),
                    payment.Amount.ToString("F2"),
                    payment.Amount.ToString("F2"),
                    Csv(payment.FeeId.HasValue ? "Fee income" : "Rent income"),
                    Csv(payment.PropertyName ?? ""),
                    Csv(payment.TenantName ?? "Tenant"),
                    Csv(payment.Method ?? ""),
                    Csv("")));
            }

            return sb.ToString();
        }

        private static string GenerateAccountantPackageSummary(List<LoadExpenseDto> expenses, List<LoadPaymentDto> payments, TaxReadinessDto? readiness, int year)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"Property Peace Accountant Tax Package,{year}");
            sb.AppendLine();
            sb.AppendLine("Readiness Metric,Value,Status,Notes");
            if (readiness != null)
            {
                sb.AppendLine(string.Join(',', Csv("Overall readiness score"), readiness.OverallScore, Csv(readiness.IsReadyForAccountant ? "Ready" : "Needs review"), Csv("Generated from deterministic report checks")));
                foreach (var item in readiness.Items)
                    sb.AppendLine(string.Join(',', Csv(item.Label), item.Count, Csv(item.Status), Csv(item.Description)));
            }

            sb.AppendLine();
            sb.AppendLine("Per Property Summary");
            sb.AppendLine("Property,Income,Deductible Expenses,Net Income,Expenses,Missing Receipts,Review Items");
            foreach (var property in readiness?.PropertyPackages ?? [])
            {
                sb.AppendLine(string.Join(',', Csv(property.PropertyName), property.Income.ToString("F2"), property.DeductibleExpenses.ToString("F2"), property.NetIncome.ToString("F2"), property.ExpenseCount, property.MissingReceiptCount, property.ReviewItemCount));
            }

            sb.AppendLine();
            sb.AppendLine(GenerateCSVFormat(expenses, payments));
            return sb.ToString();
        }

        private static string GenerateQuickBooksFormat(List<LoadExpenseDto> expenses, List<LoadPaymentDto> payments)
        {
            var sb = new StringBuilder();
            sb.AppendLine("!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tCLEAR\tMEMO");
            sb.AppendLine("!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tCLEAR\tMEMO");
            sb.AppendLine("!ENDTRNS");

            foreach (var expense in expenses.OrderBy(e => e.ExpenseDate))
            {
                var amount = GetDeductibleAmount(expense);
                if (amount <= 0) continue;
                sb.AppendLine($"TRNS\t\t{expense.ExpenseDate:MM/dd/yyyy}\tExpense\t{GetVendorName(expense) ?? "Vendor"}\t-{amount:F2}\t{expense.Id}\tN\t{expense.Name}");
                sb.AppendLine($"SPL\t\t{expense.ExpenseDate:MM/dd/yyyy}\tAccounts Payable\t{GetVendorName(expense) ?? "Vendor"}\t{amount:F2}\t{expense.Id}\tN\t{expense.Name}");
                sb.AppendLine("ENDTRNS");
            }

            foreach (var payment in payments.OrderBy(p => p.PaymentDate))
            {
                sb.AppendLine($"TRNS\t\t{payment.PaymentDate:MM/dd/yyyy}\tIncome\t{payment.TenantName ?? "Tenant"}\t{payment.Amount:F2}\t{payment.LeaseId}\tN\t{(payment.FeeId.HasValue ? payment.FeeName ?? "Fee Payment" : "Rent Payment")}");
                sb.AppendLine($"SPL\t\t{payment.PaymentDate:MM/dd/yyyy}\tAccounts Receivable\t{payment.TenantName ?? "Tenant"}\t-{payment.Amount:F2}\t{payment.LeaseId}\tN\t{(payment.FeeId.HasValue ? payment.FeeName ?? "Fee Payment" : "Rent Payment")}");
                sb.AppendLine("ENDTRNS");
            }

            return sb.ToString();
        }

        private static string GenerateXeroFormat(List<LoadExpenseDto> expenses, List<LoadPaymentDto> payments)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Contact Name,Email Address,PO Address Line 1,PO Address Line 2,PO Address Line 3,PO Address Line 4,PO City,PO Region,PO Postal Code,PO Country,Invoice Number,Invoice Date,Due Date,Inventory Item Code,Description,Quantity,Unit Amount,Discount,Account Code,Tax Type,Tax Amount,Currency,Total");

            foreach (var expense in expenses.OrderBy(e => e.ExpenseDate))
            {
                var amount = GetDeductibleAmount(expense);
                if (amount <= 0) continue;
                sb.AppendLine($"{Csv(GetVendorName(expense) ?? "Vendor")},\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",{expense.Id},{expense.ExpenseDate:yyyy-MM-dd},{expense.ExpenseDate:yyyy-MM-dd},\"\",{Csv(expense.Name)},1,{amount:F2},0,200,None,0,USD,{amount:F2}");
            }

            foreach (var payment in payments.OrderBy(p => p.PaymentDate))
            {
                sb.AppendLine($"{Csv(payment.TenantName ?? "Tenant")},\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",{payment.LeaseId},{payment.PaymentDate:yyyy-MM-dd},{payment.PaymentDate:yyyy-MM-dd},\"\",{Csv(payment.FeeId.HasValue ? payment.FeeName ?? "Fee Payment" : "Rent Payment")},1,{payment.Amount:F2},0,400,None,0,USD,{payment.Amount:F2}");
            }

            return sb.ToString();
        }

        private static string Csv(string value)
        {
            var safe = value ?? string.Empty;
            return $"\"{safe.Replace("\"", "\"\"")}\"";
        }
    }
}
