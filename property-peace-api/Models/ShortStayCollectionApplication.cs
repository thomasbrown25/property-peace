namespace brownstone_hub_api.Models;

// Independent of rent payment / Stripe Connect preparation. The applicant is the sole payee;
// the account ID is a snapshot of that user's Connect account at application time.
// Identity and payout details remain with Stripe, never in this aggregate.
public sealed class ShortStayCollectionApplication
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;
    public long ApplicantUserId { get; set; }
    public User ApplicantUser { get; set; } = null!;
    public string StripeAccountId { get; set; } = string.Empty;
    public ShortStayCollectionApplicationStatus Status { get; set; } = ShortStayCollectionApplicationStatus.Draft;
    public string? IdentityVerificationSessionId { get; set; }
    public DateTimeOffset? IdentityVerifiedAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public long? ApprovedByUserId { get; set; }
    // Timestamp of independent admin confirmation, recorded with the approving reviewer and case reference.
    public DateTimeOffset? PropertyAuthorityConfirmedAt { get; set; }
    public DateTimeOffset? SuspendedAt { get; set; }
    public long? SuspendedByUserId { get; set; }
    // Internal, non-sensitive case identifier only; never store identity evidence here.
    public string? ApprovalCaseReference { get; set; }
    public DateTimeOffset? AuthorityAttestedAt { get; set; }
    public string? FeePolicyConsentVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    // Application-managed optimistic concurrency token; increment on every update.
    public long RowVersion { get; set; } = 1;
    public ICollection<ShortStayCollectionApplicationProperty> Properties { get; set; } = [];
}

public enum ShortStayCollectionApplicationStatus
{
    Draft, Submitted, IdentityPending, IdentityVerified, UnderReview,
    PayoutApproved, Suspended, Rejected
}

public sealed class ShortStayCollectionApplicationProperty
{
    public long ShortStayCollectionApplicationId { get; set; }
    public ShortStayCollectionApplication Application { get; set; } = null!;
    public long PropertyId { get; set; }
    public Property Property { get; set; } = null!;
}
