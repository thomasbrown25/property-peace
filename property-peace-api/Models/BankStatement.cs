using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class BankStatement
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization Organization { get; set; } = null!;

        public long? BankAccountId { get; set; }

        [ForeignKey(nameof(BankAccountId))]
        public BankAccount? BankAccount { get; set; }

        public DateTime? StatementDate { get; set; } // End date of statement period (optional, can be derived from transactions)

        [Column(TypeName = "decimal(18,2)")]
        public decimal? StartingBalance { get; set; } // Optional, can be calculated from previous statement

        [Column(TypeName = "decimal(18,2)")]
        public decimal? EndingBalance { get; set; } // Optional, can be calculated from transactions

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
