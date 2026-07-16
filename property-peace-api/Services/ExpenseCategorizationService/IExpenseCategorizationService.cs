using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.ExpenseCategorizationService
{
    public interface IExpenseCategorizationService
    {
        Task<ServiceResponse<ExpenseCategorizationResult>> CategorizeExpenseAsync(
            string description, 
            decimal amount, 
            string? vendor = null, 
            string? category = null);
    }

    public class ExpenseCategorizationResult
    {
        public ETaxCategory? TaxCategory { get; set; }
        public bool IsTaxDeductible { get; set; }
        public bool IsLoanPayment { get; set; }
        public decimal? LoanInterestAmount { get; set; }
        public decimal? LoanPrincipalAmount { get; set; }
        public string? LoanProvider { get; set; }
        public string? Reasoning { get; set; }
    }
}
