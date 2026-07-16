using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class BankReconciliation
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long BankStatementId { get; set; }

        [ForeignKey(nameof(BankStatementId))]
        public BankStatement BankStatement { get; set; } = null!;

        [Required]
        public DateTime ReconciledDate { get; set; }

        [Required]
        public long ReconciledByUserId { get; set; }

        [ForeignKey(nameof(ReconciledByUserId))]
        public User ReconciledByUser { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Reconciled

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
