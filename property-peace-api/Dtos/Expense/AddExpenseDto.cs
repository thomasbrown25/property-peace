using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Expense
{
    public class AddExpenseDto
    {
        [Required]
        public long LandlordId { get; set; }

        [Required]
        public long PropertyId { get; set; }

        public long? UnitId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty; // Combined name/notes field

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime ExpenseDate { get; set; }

        [MaxLength(200)]
        public string? Vendor { get; set; } // Legacy field, kept for backward compatibility

        public long? VendorId { get; set; }

        [MaxLength(50)]
        public string? PaymentMethod { get; set; }

        [MaxLength(500)]
        public string? ReceiptUrl { get; set; }

        public bool IsRecurring { get; set; } = false;

        // Recurring expense fields (only used when IsRecurring is true)
        public ERecurringFrequency? Frequency { get; set; } // Null for regular expenses (One Time)

        [Range(1, 31, ErrorMessage = "Day of period must be between 1 and 31")]
        public int? DayOfPeriod { get; set; } // Day of month for recurring expenses

        public DateTime? StartDate { get; set; } // Start date for recurring expenses

        public DateTime? EndDate { get; set; } // Optional end date for recurring expenses

        public bool IsPaused { get; set; } = false;

        public bool IsTaxDeductible { get; set; } = false;

        public ETaxCategory? TaxCategory { get; set; }

        // Loan payment fields
        public bool IsLoanPayment { get; set; } = false;

        public decimal? LoanPrincipalAmount { get; set; }

        public decimal? LoanInterestAmount { get; set; }

        [MaxLength(200)]
        public string? LoanProvider { get; set; }

        public long? MaintenanceRequestId { get; set; }

        // Accounts Payable fields
        public DateTime? BillDate { get; set; }
        public DateTime? DueDate { get; set; }
        public bool IsPaid { get; set; } = false;
        public DateTime? PaidDate { get; set; }
        [MaxLength(100)]
        public string? BillNumber { get; set; }
    }
}

