using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Stripe
{
    public sealed class ApproveStripePayeeRequest
    {
        public string Evidence { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public bool PropertyAuthorityAttested { get; set; }
        public long OrganizationId { get; set; }
    }

    public sealed class SuspendStripePayeeRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    public sealed record StripePayeeReviewDto(
        string StripeAccountId,
        long? UserId,
        StripePayeeReviewStatus Status,
        DateTimeOffset CreatedAt,
        DateTimeOffset? ApprovedAt,
        long? ApprovedByUserId,
        string? ApprovalEvidence,
        string? ApprovalNotes,
        bool PropertyAuthorityAttested,
        long? ApprovedOrganizationId,
        DateTimeOffset? SuspendedAt,
        string? SuspensionReason,
        DateTimeOffset? LastStripeSnapshotAt,
        bool StripeDetailsSubmitted,
        bool StripePayoutsEnabled,
        bool StripeTransfersActive,
        int CurrentlyDueRequirementCount,
        int PastDueRequirementCount,
        string? StripeDisabledReason,
        string PayoutSchedulePolicy,
        bool InstantPayoutsAllowed);
}
