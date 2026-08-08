using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models
{
    public enum StripeRentPaymentStatus
    {
        Created,
        Held,
        TransferPending,
        TransferReconciliationPending,
        Transferred,
        ReversalPending,
        Reversed,
        RecoveryFailed,
        Blocked,
        Failed,
        Canceled,
        // Appended to preserve the persisted numeric values of existing lifecycle states.
        Processing
    }

    public class StripeRentPayment
    {
        public long Id { get; set; }
        [MaxLength(64)] public string OperationId { get; set; } = string.Empty;
        [MaxLength(255)] public string PaymentIntentId { get; set; } = string.Empty;
        public long LeaseId { get; set; }
        public long OrganizationId { get; set; }
        public long TenantUserId { get; set; }
        public long AmountCents { get; set; }
        [MaxLength(3)] public string Currency { get; set; } = "usd";
        [MaxLength(255)] public string DestinationStripeAccountId { get; set; } = string.Empty;
        public StripeRentPaymentStatus Status { get; set; }
        [MaxLength(255)] public string? StripeChargeId { get; set; }
        [MaxLength(50)] public string? PaymentMethodType { get; set; }
        public DateTimeOffset? HeldAt { get; set; }
        public DateTimeOffset? TransferEligibleAt { get; set; }
        [MaxLength(255)] public string? StripeTransferId { get; set; }
        [MaxLength(255)] public string? StripeTransferReversalId { get; set; }
        public long ReversedAmountCents { get; set; }
        public long ReversalTargetAmountCents { get; set; }
        public long ReversalIncrementAmountCents { get; set; }
        public int TransferAttemptCount { get; set; }
        public int TransferReplayFailureCount { get; set; }
        public bool TransferReconciliationPaused { get; set; }
        [MaxLength(255)] public string? TransferIdempotencyKey { get; set; }
        public int ReversalAttemptCount { get; set; }
        public DateTimeOffset? LastReversalAttemptAt { get; set; }
        [MaxLength(1000)] public string? LastReversalError { get; set; }
        public DateTimeOffset? LastTransferAttemptAt { get; set; }
        public DateTimeOffset? TransferredAt { get; set; }
        public DateTimeOffset? AllocationCompletedAt { get; set; }
        public DateTimeOffset? RefundedAt { get; set; }
        public long RefundedAmountCents { get; set; }
        public DateTimeOffset? DisputedAt { get; set; }
        public long DisputedAmountCents { get; set; }
        public long DisputeRecoveredAmountCents { get; set; }
        public DateTimeOffset? DisputeClosedAt { get; set; }
        [MaxLength(32)] public string? StripeDisputeStatus { get; set; }
        public DateTimeOffset? NextTransferAttemptAt { get; set; }
        [MaxLength(255)] public string? StripeRefundId { get; set; }
        [MaxLength(255)] public string? StripeDisputeId { get; set; }
        [MaxLength(1000)] public string? RiskReason { get; set; }
        [MaxLength(1000)] public string? LastTransferError { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        [Timestamp] public byte[]? RowVersion { get; set; }

        public Lease? Lease { get; set; }
        public Organization? Organization { get; set; }
    }
}
