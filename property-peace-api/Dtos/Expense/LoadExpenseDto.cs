using brownstone_hub_api.Dtos.ExpenseReceipt;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Expense
{
    public class LoadExpenseDto
    {
        public long Id { get; set; }
        public long LandlordId { get; set; }
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        public string Name { get; set; } = string.Empty; // Combined name/notes field
        public string Category { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string? Vendor { get; set; } // Legacy field, kept for backward compatibility
        public long? VendorId { get; set; }
        public string? VendorName { get; set; } // Vendor name from Vendor entity
        public string? VendorEmail { get; set; } // Vendor email from Vendor entity
        public string? VendorPhone { get; set; } // Vendor phone from Vendor entity
        public string? VendorTaxId { get; set; }
        public string? VendorAddress { get; set; }
        public bool VendorRequires1099 { get; set; }
        public string? PaymentMethod { get; set; }
        public string? ReceiptUrl { get; set; } // Legacy single receipt URL (kept for backward compatibility)
        public List<LoadExpenseReceiptDto> Receipts { get; set; } = []; // Multiple receipts
        public bool HasReceipt => !string.IsNullOrWhiteSpace(ReceiptUrl) || Receipts.Any();
        public bool IsRecurring { get; set; }

        // Recurring expense fields
        public ERecurringFrequency? Frequency { get; set; } // Null for regular expenses (One Time)
        public int? DayOfPeriod { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? LastGeneratedDate { get; set; }
        public DateTime? NextOccurrenceDate { get; set; }
        public bool IsPaused { get; set; }

        public bool IsTaxDeductible { get; set; }
        public ETaxCategory? TaxCategory { get; set; }
        public bool IsLoanPayment { get; set; }
        public decimal? LoanPrincipalAmount { get; set; }
        public decimal? LoanInterestAmount { get; set; }
        public string? LoanProvider { get; set; }
        public long? MaintenanceRequestId { get; set; }

        // Accounts Payable fields
        public DateTime? BillDate { get; set; }
        public DateTime? DueDate { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? PaidDate { get; set; }
        public string? BillNumber { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

