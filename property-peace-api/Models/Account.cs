using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Account
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization Organization { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string AccountCode { get; set; } = string.Empty; // e.g., "4000", "5100"

        [Required]
        [MaxLength(200)]
        public string AccountName { get; set; } = string.Empty;

        [Required]
        public EAccountType AccountType { get; set; }

        // Parent account for hierarchy (nullable for top-level accounts)
        public long? ParentAccountId { get; set; }

        [ForeignKey(nameof(ParentAccountId))]
        public Account? ParentAccount { get; set; }

        // Navigation property for child accounts
        public ICollection<Account> ChildAccounts { get; set; } = [];

        // System accounts are pre-populated and cannot be deleted
        public bool IsSystemAccount { get; set; } = false;

        public bool IsActive { get; set; } = true;

        // Description/notes
        [MaxLength(500)]
        public string? Description { get; set; }

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
