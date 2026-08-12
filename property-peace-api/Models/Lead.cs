using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models;

public sealed class Lead
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ListingId { get; set; }
    public long PropertyId { get; set; }
    public long? UnitId { get; set; }
    [MaxLength(200)] public string Name { get; set; } = "";
    [MaxLength(320)] public string Email { get; set; } = "";
    [MaxLength(320)] public string NormalizedEmail { get; set; } = "";
    [MaxLength(32)] public string? Phone { get; set; }
    [MaxLength(32)] public string? NormalizedPhone { get; set; }
    [MaxLength(64)] public string ContactIdentityHash { get; set; } = "";
    [MaxLength(64)] public string VerificationTokenHash { get; set; } = "";
    [MaxLength(64)] public string? PublicAccessTokenHash { get; set; }
    public DateTime VerificationExpiresAtUtc { get; set; }
    public DateTime? ContactVerifiedAtUtc { get; set; }
    public LeadStatus Status { get; set; }
    public long? OwnerUserId { get; set; }
    public long? AssignedTeamMemberId { get; set; }
    public DateTime? NextFollowUpAtUtc { get; set; }
    public long? RentalApplicationId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public DateTime? ContactedAtUtc { get; set; }
    public DateTime? QualifiedAtUtc { get; set; }
    public DateTime? ShowingReachedAtUtc { get; set; }
    public DateTime? AppliedAtUtc { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public sealed class LeadSource
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public LeadSourceKind Kind { get; set; }
    [MaxLength(100)] public string? Campaign { get; set; }
    [MaxLength(64)] public string IdempotencyKeyHash { get; set; } = "";
    [MaxLength(64)] public string RequestHash { get; set; } = "";
    [MaxLength(64)] public string Receipt { get; set; } = "";
    public DateTime AttributedAtUtc { get; set; }
}

public sealed class PreScreenConfiguration
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ListingId { get; set; }
    public bool AskMoveInDate { get; set; } = true;
    public bool AskOccupants { get; set; } = true;
    public bool AskPets { get; set; } = true;
    public bool AskSmoking { get; set; } = true;
    public bool AskIncomeRange { get; set; } = true;
    public bool AskRequestedShowingTime { get; set; } = true;
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public sealed class PreScreenResponse
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public DateOnly? MoveInDate { get; set; }
    public int? Occupants { get; set; }
    public bool? HasPets { get; set; }
    public bool? Smoking { get; set; }
    [MaxLength(30)] public string? IncomeRange { get; set; }
    public DateTime? RequestedShowingAtUtc { get; set; }
}

public sealed class ShowingAvailability
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ListingId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    [MaxLength(100)] public string TimeZoneId { get; set; } = "UTC";
    public bool IsDisabled { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public sealed class Showing
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public long ListingId { get; set; }
    public long PropertyId { get; set; }
    public long? UnitId { get; set; }
    public long AvailabilityId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    [MaxLength(100)] public string BoundaryTimeZoneId { get; set; } = "UTC";
    public ShowingStatus Status { get; set; }
    [MaxLength(64)] public string IdempotencyKeyHash { get; set; } = "";
    [MaxLength(64)] public string RequestHash { get; set; } = "";
    [MaxLength(64)] public string? RescheduleIdempotencyKeyHash { get; set; }
    [MaxLength(64)] public string? RescheduleRequestHash { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public sealed class LeadNote
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public long AuthorUserId { get; set; }
    [MaxLength(2000)] public string Body { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class LeadTask
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public long? AssigneeUserId { get; set; }
    [MaxLength(200)] public string Title { get; set; } = "";
    public DateTime? DueAtUtc { get; set; }
    public LeadTaskStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public sealed class LeadNotificationIntent
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public long? ShowingId { get; set; }
    public LeadNotificationKind Kind { get; set; }
    public NotificationIntentStatus Status { get; set; }
    public DateTime NotBeforeUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    [MaxLength(500)] public string? LastError { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTime? LeaseUntilUtc { get; set; }
}

/// <summary>A durable encrypted/opaque token-delivery outbox; plaintext secrets never persist here.</summary>
public sealed class LeadTokenDelivery
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long LeadId { get; set; }
    public LeadTokenPurpose Purpose { get; set; }
    [MaxLength(4000)] public string ProtectedPayload { get; set; } = "";
    [MaxLength(320)] public string Destination { get; set; } = "";
    public NotificationIntentStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    [MaxLength(500)] public string? LastError { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTime? LeaseUntilUtc { get; set; }
}

/// <summary>Immutable replay ledger for showing mutations; keys survive later reschedules.</summary>
public sealed class ShowingOperation
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ShowingId { get; set; }
    [MaxLength(30)] public string Operation { get; set; } = "";
    [MaxLength(64)] public string IdempotencyKeyHash { get; set; } = "";
    [MaxLength(64)] public string RequestHash { get; set; } = "";
    public long ResultAvailabilityId { get; set; }
    public DateTime ResultStartsAtUtc { get; set; }
    public DateTime ResultEndsAtUtc { get; set; }
    [MaxLength(100)] public string ResultTimeZoneId { get; set; } = "UTC";
    public ShowingStatus ResultStatus { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
