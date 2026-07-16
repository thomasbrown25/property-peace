using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class StripePaymentMethod
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long PaymentId { get; set; }

        [ForeignKey(nameof(PaymentId))]
        public Payment Payment { get; set; } = null!;

        public long? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User? User { get; set; }

        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        [Required]
        [MaxLength(100)]
        public string StripePaymentIntentId { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? StripePaymentMethodId { get; set; }

        [MaxLength(50)]
        public string? Type { get; set; }

        [MaxLength(50)]
        public string? Brand { get; set; }

        [MaxLength(4)]
        public string? Last4 { get; set; }

        public long? ExpMonth { get; set; }
        public long? ExpYear { get; set; }

        [MaxLength(100)]
        public string? BankName { get; set; }

        [MaxLength(100)]
        public string? WalletType { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
