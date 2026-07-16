using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class BankAccount
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization Organization { get; set; } = null!;

        [Required]
        [MaxLength(255)]
        public string StripeAccountId { get; set; } = string.Empty; // Stripe Connect account ID

        [Required]
        [MaxLength(200)]
        public string DisplayName { get; set; } = string.Empty; // User-friendly name like "Main Business Account"

        [MaxLength(50)]
        public string? Last4 { get; set; } // Last 4 digits of bank account (if available from Stripe)

        [MaxLength(200)]
        public string? BankName { get; set; } // Bank name (if available from Stripe)

        [MaxLength(50)]
        public string? AccountType { get; set; } // e.g., "checking", "savings" (if available from Stripe)

        public bool IsActive { get; set; } = true;

        public bool IsDefault { get; set; } = false; // Default account for the organization

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}

