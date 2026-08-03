namespace brownstone_hub_api.Models
{
    public enum StripePayeeReviewStatus
    {
        Onboarding,
        StripeVerified,
        UnderReview,
        PayoutApproved,
        Suspended
    }

    /// <summary>
    /// Internal connected-payee decision and Stripe eligibility snapshot. Deliberately contains
    /// no identity document, tax ID, birth date, address, or other raw KYC data.
    /// </summary>
    public sealed class StripeConnectedPayeeReview
    {
        public long Id { get; set; }
        public long? UserId { get; set; }
        public User? User { get; set; }
        public string StripeAccountId { get; set; } = string.Empty;
        public StripePayeeReviewStatus Status { get; set; } = StripePayeeReviewStatus.Onboarding;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public DateTimeOffset? ApprovedAt { get; set; }
        public long? ApprovedByUserId { get; set; }
        public string? ApprovalEvidence { get; set; }
        public string? ApprovalNotes { get; set; }
        public bool PropertyAuthorityAttested { get; set; }
        public long? ApprovedOrganizationId { get; set; }
        public DateTimeOffset? SuspendedAt { get; set; }
        public long? SuspendedByUserId { get; set; }
        public string? SuspensionReason { get; set; }
        // Actual eligibility observed from Stripe. Any true value is fail-closed for controlled launch.
        public bool InstantPayoutsAllowed { get; set; } = false;
        public string PayoutSchedulePolicy { get; set; } = "manual";

        // Non-PII Stripe eligibility facts needed for deterministic transfer decisions.
        public DateTimeOffset? LastStripeSnapshotAt { get; set; }
        public bool StripeDetailsSubmitted { get; set; }
        public bool StripePayoutsEnabled { get; set; }
        public bool StripeTransfersActive { get; set; }
        public string? StripeTransferCapabilityStatus { get; set; }
        public int CurrentlyDueRequirementCount { get; set; }
        public int PastDueRequirementCount { get; set; }
        public string? StripeDisabledReason { get; set; }
        public string? ExternalAccountFingerprint { get; set; }
        public string? LastStripeEventId { get; set; }
        public byte[] RowVersion { get; set; } = [];
    }
}
