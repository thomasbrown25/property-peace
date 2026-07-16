using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class Payment
    {
        [Key]
        public long Id { get; set; }

        [Required]
        public long LeaseId { get; set; }

        [ForeignKey(nameof(LeaseId))]
        public Lease Lease { get; set; } = null!;

        // You can store PropertyId directly for easier queries
        public long PropertyId { get; set; }

        // Organization ownership
        public long? OrganizationId { get; set; }

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        [Required]
        public DateTime PaymentDate { get; set; }

        // optional reference (e.g. bank transfer id, check #)
        [MaxLength(100)]
        public string? Reference { get; set; }

        // Payment method (Cash, Check, ACH, Stripe, etc.)
        [MaxLength(50)]
        public string? Method { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "Completed"; // Completed, Processing, Failed

        [MaxLength(100)]
        public string? StripePaymentIntentId { get; set; }

        [MaxLength(100)]
        public string? StripePaymentMethodId { get; set; }

        [MaxLength(100)]
        public string? StripeChargeId { get; set; }

        [MaxLength(100)]
        public string? StripeDisputeId { get; set; }

        public DateTime? SubmittedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? FailedAt { get; set; }
        public DateTime? CanceledAt { get; set; }
        public DateTime? DisputedAt { get; set; }
        public DateTime? StripeStatusChangedAt { get; set; }

        public StripePaymentMethod? StripePaymentMethod { get; set; }

        // Track who created the payment (for manual landlord entries)
        public long? CreatedByUserId { get; set; }

        // Link to specific fee or deposit for partial payment tracking
        public long? FeeId { get; set; } // Link to LeaseFee if this payment is for a specific fee
        public long? DepositId { get; set; } // Link to Deposit if this payment is for a specific deposit

        [ForeignKey(nameof(FeeId))]
        public LeaseFee? Fee { get; set; }

        [ForeignKey(nameof(DepositId))]
        public Deposit? Deposit { get; set; }

        // standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
