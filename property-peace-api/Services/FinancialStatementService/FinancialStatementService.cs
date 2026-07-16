using brownstone_hub_api.Dtos.FinancialStatements;
using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Accounts;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.FinancialStatementService
{
    public class FinancialStatementService : IFinancialStatementService
    {
        private readonly IGeneralLedgerService _generalLedgerService;
        private readonly IAccountRepository _accountRepository;
        private readonly ILogger<FinancialStatementService> _logger;

        public FinancialStatementService(
            IGeneralLedgerService generalLedgerService,
            IAccountRepository accountRepository,
            ILogger<FinancialStatementService> logger)
        {
            _generalLedgerService = generalLedgerService;
            _accountRepository = accountRepository;
            _logger = logger;
        }

        public async Task<ServiceResponse<ProfitAndLossDto>> GetProfitAndLossAsync(long organizationId, DateTime startDate, DateTime endDate)
        {
            var response = new ServiceResponse<ProfitAndLossDto>();

            try
            {
                // Get all ledger entries for the date range
                var entriesResponse = await _generalLedgerService.GetEntriesByDateRangeAsync(organizationId, startDate, endDate);
                if (!entriesResponse.Success || entriesResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = "Failed to retrieve ledger entries";
                    return response;
                }

                var entries = entriesResponse.Data;

                // Get all accounts for the organization
                var accounts = await _accountRepository.GetAccountsByOrganizationIdAsync(organizationId);
                var accountDict = accounts.ToDictionary(a => a.Id, a => a);

                // Group entries by account and calculate totals
                var incomeGroups = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                accountDict[e.AccountId].AccountType == EAccountType.Income)
                    .GroupBy(e => new { e.AccountId, e.AccountCode, e.AccountName })
                    .Select(g => new IncomeLineItem
                    {
                        AccountCode = g.Key.AccountCode,
                        AccountName = g.Key.AccountName,
                        Amount = g.Sum(e => e.Amount)
                    })
                    .Where(item => item.Amount != 0)
                    .OrderBy(item => item.AccountCode)
                    .ToList();

                var expenseGroups = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                accountDict[e.AccountId].AccountType == EAccountType.Expense)
                    .GroupBy(e => new { e.AccountId, e.AccountCode, e.AccountName })
                    .Select(g => new ExpenseLineItem
                    {
                        AccountCode = g.Key.AccountCode,
                        AccountName = g.Key.AccountName,
                        Amount = Math.Abs(g.Sum(e => e.Amount)) // Expenses are negative, make positive for display
                    })
                    .Where(item => item.Amount != 0)
                    .OrderBy(item => item.AccountCode)
                    .ToList();

                var totalIncome = incomeGroups.Sum(i => i.Amount);
                var totalExpenses = expenseGroups.Sum(e => e.Amount);
                var netIncome = totalIncome - totalExpenses;

                var pnl = new ProfitAndLossDto
                {
                    StartDate = startDate,
                    EndDate = endDate,
                    Income = incomeGroups,
                    TotalIncome = totalIncome,
                    Expenses = expenseGroups,
                    TotalExpenses = totalExpenses,
                    NetIncome = netIncome
                };

                response.Data = pnl;
                response.Message = "Profit and Loss statement generated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Profit and Loss statement");
                response.Success = false;
                response.Message = $"Error generating Profit and Loss statement: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<BalanceSheetDto>> GetBalanceSheetAsync(long organizationId, DateTime asOfDate)
        {
            var response = new ServiceResponse<BalanceSheetDto>();

            try
            {
                // Get all account balances as of the date
                var balancesResponse = await _generalLedgerService.GetAccountBalancesAsync(organizationId, asOfDate);
                if (!balancesResponse.Success || balancesResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = "Failed to retrieve account balances";
                    return response;
                }

                var balances = balancesResponse.Data;

                // Get all accounts to determine account types
                var accounts = await _accountRepository.GetAccountsByOrganizationIdAsync(organizationId);
                var accountDict = accounts.ToDictionary(a => a.Id, a => a);

                // Group balances by account type
                var assets = balances
                    .Where(b => accountDict.ContainsKey(b.AccountId) && 
                                accountDict[b.AccountId].AccountType == EAccountType.Asset)
                    .Select(b => new AssetLineItem
                    {
                        AccountCode = b.AccountCode,
                        AccountName = b.AccountName,
                        Balance = b.Balance
                    })
                    .Where(item => item.Balance != 0)
                    .OrderBy(item => item.AccountCode)
                    .ToList();

                var liabilities = balances
                    .Where(b => accountDict.ContainsKey(b.AccountId) && 
                                accountDict[b.AccountId].AccountType == EAccountType.Liability)
                    .Select(b => new LiabilityLineItem
                    {
                        AccountCode = b.AccountCode,
                        AccountName = b.AccountName,
                        Balance = Math.Abs(b.Balance) // Liabilities are negative, make positive for display
                    })
                    .Where(item => item.Balance != 0)
                    .OrderBy(item => item.AccountCode)
                    .ToList();

                var equity = balances
                    .Where(b => accountDict.ContainsKey(b.AccountId) && 
                                accountDict[b.AccountId].AccountType == EAccountType.Equity)
                    .Select(b => new EquityLineItem
                    {
                        AccountCode = b.AccountCode,
                        AccountName = b.AccountName,
                        Balance = b.Balance
                    })
                    .Where(item => item.Balance != 0)
                    .OrderBy(item => item.AccountCode)
                    .ToList();

                var totalAssets = assets.Sum(a => a.Balance);
                var totalLiabilities = liabilities.Sum(l => l.Balance);
                var totalEquity = equity.Sum(e => e.Balance);
                var totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

                var balanceSheet = new BalanceSheetDto
                {
                    AsOfDate = asOfDate,
                    Assets = assets,
                    TotalAssets = totalAssets,
                    Liabilities = liabilities,
                    TotalLiabilities = totalLiabilities,
                    Equity = equity,
                    TotalEquity = totalEquity,
                    TotalLiabilitiesAndEquity = totalLiabilitiesAndEquity
                };

                response.Data = balanceSheet;
                response.Message = "Balance Sheet generated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Balance Sheet");
                response.Success = false;
                response.Message = $"Error generating Balance Sheet: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<CashFlowDto>> GetCashFlowAsync(long organizationId, DateTime startDate, DateTime endDate)
        {
            var response = new ServiceResponse<CashFlowDto>();

            try
            {
                // Get all ledger entries for the date range
                var entriesResponse = await _generalLedgerService.GetEntriesByDateRangeAsync(organizationId, startDate, endDate);
                if (!entriesResponse.Success || entriesResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = "Failed to retrieve ledger entries";
                    return response;
                }

                var entries = entriesResponse.Data;

                // Get all accounts
                var accounts = await _accountRepository.GetAccountsByOrganizationIdAsync(organizationId);
                var accountDict = accounts.ToDictionary(a => a.Id, a => a);

                // Calculate Net Income (from P&L)
                var incomeTotal = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                accountDict[e.AccountId].AccountType == EAccountType.Income)
                    .Sum(e => e.Amount);

                var expenseTotal = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                accountDict[e.AccountId].AccountType == EAccountType.Expense)
                    .Sum(e => e.Amount);

                var netIncome = incomeTotal - Math.Abs(expenseTotal);

                // Operating Activities
                // For now, we'll use a simplified approach: Net Income + adjustments
                // In a full implementation, you'd have depreciation, changes in working capital, etc.
                var operatingActivities = new OperatingActivities
                {
                    NetIncome = netIncome,
                    Adjustments = new List<CashFlowLineItem>(), // Placeholder for future adjustments
                    NetCashFromOperations = netIncome
                };

                // Investing Activities
                // Typically includes purchases/sales of assets, equipment, property
                // For now, we'll look for transactions affecting asset accounts
                var investingItems = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                accountDict[e.AccountId].AccountType == EAccountType.Asset &&
                                !accountDict[e.AccountId].AccountCode.StartsWith("1")) // Exclude cash accounts (typically 1000-1999)
                    .GroupBy(e => e.Description ?? "Asset Transaction")
                    .Select(g => new CashFlowLineItem
                    {
                        Description = g.Key,
                        Amount = g.Sum(e => e.Amount)
                    })
                    .ToList();

                var netCashFromInvesting = investingItems.Sum(i => i.Amount);

                // Financing Activities
                // Typically includes loans, equity contributions, distributions
                // For now, we'll look for transactions affecting liability and equity accounts
                var financingItems = entries
                    .Where(e => accountDict.ContainsKey(e.AccountId) && 
                                (accountDict[e.AccountId].AccountType == EAccountType.Liability ||
                                 accountDict[e.AccountId].AccountType == EAccountType.Equity))
                    .GroupBy(e => e.Description ?? "Financing Transaction")
                    .Select(g => new CashFlowLineItem
                    {
                        Description = g.Key,
                        Amount = g.Sum(e => e.Amount)
                    })
                    .ToList();

                var netCashFromFinancing = financingItems.Sum(i => i.Amount);

                // Get beginning and ending cash balances
                var cashAccounts = accounts.Where(a => a.AccountType == EAccountType.Asset && 
                                                       a.AccountCode.StartsWith("1")).ToList();
                
                var beginningCash = 0m;
                var endingCash = 0m;

                foreach (var cashAccount in cashAccounts)
                {
                    var beginningBalance = await _generalLedgerService.GetAccountBalanceAsync(organizationId, cashAccount.Id, startDate.AddDays(-1));
                    var endingBalance = await _generalLedgerService.GetAccountBalanceAsync(organizationId, cashAccount.Id, endDate);
                    
                    if (beginningBalance.Success)
                        beginningCash += beginningBalance.Data;
                    
                    if (endingBalance.Success)
                        endingCash += endingBalance.Data;
                }

                var netChangeInCash = operatingActivities.NetCashFromOperations + netCashFromInvesting + netCashFromFinancing;

                var cashFlow = new CashFlowDto
                {
                    StartDate = startDate,
                    EndDate = endDate,
                    OperatingActivities = operatingActivities,
                    InvestingActivities = new InvestingActivities
                    {
                        Items = investingItems,
                        NetCashFromInvesting = netCashFromInvesting
                    },
                    FinancingActivities = new FinancingActivities
                    {
                        Items = financingItems,
                        NetCashFromFinancing = netCashFromFinancing
                    },
                    NetChangeInCash = netChangeInCash,
                    BeginningCash = beginningCash,
                    EndingCash = endingCash
                };

                response.Data = cashFlow;
                response.Message = "Cash Flow statement generated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Cash Flow statement");
                response.Success = false;
                response.Message = $"Error generating Cash Flow statement: {ex.Message}";
            }

            return response;
        }
    }
}
