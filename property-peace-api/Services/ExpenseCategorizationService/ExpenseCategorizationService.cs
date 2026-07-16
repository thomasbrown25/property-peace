using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.OpenAIService;
using System.Text.Json;

namespace brownstone_hub_api.Services.ExpenseCategorizationService
{
    public class ExpenseCategorizationService(
        IOpenAIService openAIService,
        ILogger<ExpenseCategorizationService> logger) : IExpenseCategorizationService
    {
        private readonly IOpenAIService _openAIService = openAIService;
        private readonly ILogger<ExpenseCategorizationService> _logger = logger;

        public async Task<ServiceResponse<ExpenseCategorizationResult>> CategorizeExpenseAsync(
            string description, 
            decimal amount, 
            string? vendor = null, 
            string? category = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(description))
                {
                    return ServiceResponse<ExpenseCategorizationResult>.CreateError(
                        "Description required", 
                        "Expense description is required for categorization");
                }

                var prompt = BuildCategorizationPrompt(description, amount, vendor, category);
                
                var aiResponse = await _openAIService.GenerateJsonAsync<ExpenseCategorizationJsonResponse>(prompt, 1500);
                
                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI categorization failed: {Error}", aiResponse.Message);
                    // Return default result (uncategorized, not deductible)
                    return ServiceResponse<ExpenseCategorizationResult>.CreateSuccess(
                        new ExpenseCategorizationResult
                        {
                            TaxCategory = ETaxCategory.None,
                            IsTaxDeductible = false,
                            IsLoanPayment = false
                        });
                }

                var jsonData = aiResponse.Data;
                
                // Map JSON response to result
                var result = new ExpenseCategorizationResult
                {
                    TaxCategory = jsonData.taxCategory.HasValue ? (ETaxCategory?)jsonData.taxCategory.Value : null,
                    IsTaxDeductible = jsonData.isTaxDeductible,
                    IsLoanPayment = jsonData.isLoanPayment,
                    LoanInterestAmount = jsonData.loanInterestAmount,
                    LoanPrincipalAmount = jsonData.loanPrincipalAmount,
                    LoanProvider = jsonData.loanProvider,
                    Reasoning = jsonData.reasoning
                };
                
                // Validate and set defaults
                if (result.TaxCategory == null || result.TaxCategory == ETaxCategory.None)
                {
                    result.IsTaxDeductible = false;
                }
                else
                {
                    // If tax category is set, it's generally deductible (except depreciation/improvements)
                    result.IsTaxDeductible = result.TaxCategory != ETaxCategory.Depreciation 
                        && result.TaxCategory != ETaxCategory.Improvements;
                }

                // Validate loan payment amounts
                if (result.IsLoanPayment)
                {
                    if (!result.LoanInterestAmount.HasValue)
                        result.LoanInterestAmount = 0;
                    if (!result.LoanPrincipalAmount.HasValue)
                        result.LoanPrincipalAmount = amount - result.LoanInterestAmount.Value;
                    
                    // Ensure amounts add up correctly
                    if (result.LoanInterestAmount.Value + result.LoanPrincipalAmount.Value != amount)
                    {
                        // Adjust principal to match total
                        result.LoanPrincipalAmount = amount - result.LoanInterestAmount.Value;
                    }
                }

                _logger.LogInformation(
                    "Successfully categorized expense: {Description} -> {TaxCategory}, IsLoanPayment: {IsLoanPayment}",
                    description, result.TaxCategory, result.IsLoanPayment);

                return ServiceResponse<ExpenseCategorizationResult>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error categorizing expense: {Description}", description);
                // Return default result on error
                return ServiceResponse<ExpenseCategorizationResult>.CreateSuccess(
                    new ExpenseCategorizationResult
                    {
                        TaxCategory = ETaxCategory.None,
                        IsTaxDeductible = false,
                        IsLoanPayment = false
                    });
            }
        }

        private string BuildCategorizationPrompt(string description, decimal amount, string? vendor, string? category)
        {
            var prompt = $@"You are a tax expert specializing in IRS Schedule E rental property expense categorization.

Analyze the following expense and categorize it according to IRS Schedule E line items:

Expense Description: {description}
Amount: ${amount:F2}
Vendor: {vendor ?? "Not specified"}
Category: {category ?? "Not specified"}

IRS Schedule E Categories:
1. Advertising - Zillow, Facebook ads, signs, marketing materials
2. Auto and Travel - Driving to property, mileage, vehicle expenses, travel costs
3. Cleaning and Maintenance - Turnover cleaning, landscaping, general maintenance
4. Commissions - Leasing agent fees, broker commissions
5. Insurance - Landlord policy, property insurance, liability insurance
6. Legal and Professional Fees - Lawyers, accountants, professional services
7. Management Fees - Property manager fees, property management software subscriptions
8. Mortgage Interest - ONLY interest portion of mortgage payments (NOT principal)
9. Other Interest - Credit lines, loans for property (interest only)
10. Repairs - Fixes that don't add value (plumbing, patches, repairs)
11. Supplies - Filters, lightbulbs, small items, office supplies
12. Taxes - Property taxes, local taxes, state taxes
13. Utilities - If landlord pays water, electric, gas, internet, phone, sewer, garbage
14. Depreciation - Building value depreciation over time (NOT a cash expense)
15. HOA Fees - Homeowners association fees (if applicable)
16. Other Expenses - Bank fees, software subscriptions, postage, miscellaneous

Special Cases:
- Loan/Mortgage Payments: If this is a loan payment, identify it as IsLoanPayment=true. Only the INTEREST portion is deductible (MortgageInterest or Interest category). Principal is NOT deductible.
- Security Deposits: These are NOT expenses - they are deposits held in trust.
- Improvements vs Repairs: Improvements add value and are capitalized (Improvements category), repairs maintain value (Repairs category).

Return a JSON object with:
{{
  ""taxCategory"": <integer enum value 0-35, or null if uncategorized>,
  ""isTaxDeductible"": <boolean>,
  ""isLoanPayment"": <boolean>,
  ""loanInterestAmount"": <decimal or null>,
  ""loanPrincipalAmount"": <decimal or null>,
  ""loanProvider"": <string or null>,
  ""reasoning"": <brief explanation of categorization>
}}

Enum Values:
0=None, 1=Repairs, 2=Maintenance, 3=Cleaning, 4=Landscaping, 5=Utilities, 6=Water, 7=Sewer, 8=Garbage, 9=Internet, 10=Phone,
11=Insurance, 12=LiabilityInsurance, 13=PropertyInsurance, 14=PropertyTaxes, 15=LocalTaxes, 16=StateTaxes,
17=PropertyManagement, 18=LegalFees, 19=AccountingFees, 20=ProfessionalServices, 21=Advertising, 22=Marketing,
23=Travel, 24=Transportation, 25=VehicleExpenses, 26=Depreciation, 27=Improvements, 28=Other, 29=Supplies,
30=OfficeExpenses, 31=BankFees, 32=Interest, 33=MortgageInterest, 34=ContractLabor, 35=Services

Important: Only return valid JSON. Do not include markdown code blocks.";

            return prompt;
        }
    }

    // JSON response class for OpenAI
    public class ExpenseCategorizationJsonResponse
    {
        public int? taxCategory { get; set; }
        public bool isTaxDeductible { get; set; }
        public bool isLoanPayment { get; set; }
        public decimal? loanInterestAmount { get; set; }
        public decimal? loanPrincipalAmount { get; set; }
        public string? loanProvider { get; set; }
        public string? reasoning { get; set; }
    }
}
