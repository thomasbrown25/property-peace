using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class GeneralLedgerEntry
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization Organization { get; set; } = null!;

        [Required]
        public long AccountId { get; set; }

        [ForeignKey(nameof(AccountId))]
        public Account Account { get; set; } = null!;

        // Polymorphic reference to the source transaction
        public long? TransactionId { get; set; } // Can be Payment.Id, Expense.Id, or JournalEntry.Id

        [Required]
        [MaxLength(50)]
        public string TransactionType { get; set; } = string.Empty; // "Payment", "Expense", "JournalEntry"

        // Single-entry amount (positive for income/assets, negative for expenses/liabilities)
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        // For future double-entry support
        [Column(TypeName = "decimal(18,2)")]
        public decimal? DebitAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CreditAmount { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? Reference { get; set; } // Check number, invoice number, etc.

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
