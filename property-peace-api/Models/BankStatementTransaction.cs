using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class BankStatementTransaction
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long BankStatementId { get; set; }

        [ForeignKey(nameof(BankStatementId))]
        public BankStatement BankStatement { get; set; } = null!;

        [Required]
        public DateTime TransactionDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; } // Positive for deposits, negative for withdrawals

        [MaxLength(100)]
        public string? Reference { get; set; } // Check number, transaction ID, etc.

        [MaxLength(50)]
        public string? CheckNumber { get; set; }

        public bool IsMatched { get; set; } = false;

        public long? MatchedLedgerEntryId { get; set; }

        [ForeignKey(nameof(MatchedLedgerEntryId))]
        public GeneralLedgerEntry? MatchedLedgerEntry { get; set; }

        public bool IsReconciled { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
