using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Expense
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LandlordId { get; set; }

        [Required]
        public long PropertyId { get; set; }

        // Organization ownership
        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        [ForeignKey(nameof(PropertyId))]
        public Property Property { get; set; } = null!;

        // Optional unit association
        public long? UnitId { get; set; }

        [ForeignKey(nameof(UnitId))]
        public Unit? Unit { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty; // Combined name/notes field

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty; // Repairs, Maintenance, Utilities, etc.

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime ExpenseDate { get; set; }

        // Vendor/Supplier information
        [MaxLength(200)]
        public string? Vendor { get; set; } // Legacy field, kept for backward compatibility

        public long? VendorId { get; set; }

        [ForeignKey(nameof(VendorId))]
        public Vendor? VendorEntity { get; set; }

        // Payment method
        [MaxLength(50)]
        public string? PaymentMethod { get; set; } // Cash, Check, Credit Card, ACH, etc.

        // Receipt attachment
        [MaxLength(500)]
        public string? ReceiptUrl { get; set; }

        public ICollection<ExpenseReceipt> Receipts { get; set; } = [];

        // Recurring expense flag
        public bool IsRecurring { get; set; } = false;

        // Recurring expense fields (only used when IsRecurring is true)
        public ERecurringFrequency? Frequency { get; set; } // Null for regular expenses (One Time)

        [Range(1, 31)]
        public int? DayOfPeriod { get; set; } // Day of month for recurring expenses

        public DateTime? StartDate { get; set; } // Start date for recurring expenses

        public DateTime? EndDate { get; set; } // Optional end date for recurring expenses

        // Date when the last expense was generated from this recurring expense
        public DateTime? LastGeneratedDate { get; set; }

        // The next date an expense should be generated
        public DateTime? NextOccurrenceDate { get; set; }

        // Whether the recurring expense is paused
        public bool IsPaused { get; set; } = false;

        // Tax deductible flag
        public bool IsTaxDeductible { get; set; } = false;

        // IRS tax category for Schedule E reporting
        public ETaxCategory? TaxCategory { get; set; }

        // Tax category reference (FK to TaxCategory table)
        public long? TaxCategoryId { get; set; }

        [ForeignKey(nameof(TaxCategoryId))]
        public TaxCategory? TaxCategoryEntity { get; set; }

        // Loan payment fields
        public bool IsLoanPayment { get; set; } = false;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LoanPrincipalAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? LoanInterestAmount { get; set; }

        [MaxLength(200)]
        public string? LoanProvider { get; set; }

        // Optional maintenance request link
        public long? MaintenanceRequestId { get; set; }

        [ForeignKey(nameof(MaintenanceRequestId))]
        public MaintenanceRequest? MaintenanceRequest { get; set; }

        // Accounts Payable fields
        public DateTime? BillDate { get; set; } // When bill was received
        public DateTime? DueDate { get; set; } // When bill is due
        public bool IsPaid { get; set; } = false; // Whether bill has been paid
        public DateTime? PaidDate { get; set; } // When bill was paid
        [MaxLength(100)]
        public string? BillNumber { get; set; } // Vendor invoice number

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}

