using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Leads;

public sealed record PreScreenAnswers(DateOnly? MoveInDate = null, int? Occupants = null, bool? HasPets = null,
    bool? Smoking = null, string? IncomeRange = null, DateTimeOffset? RequestedShowingTime = null);
public sealed record PublicInquiryRequest(string Name, string Email, string? Phone, LeadSourceKind Source,
    string IdempotencyKey, PreScreenAnswers? Answers);
public sealed record PublicInquiryResult(string Receipt, string VerificationStatus = "pending");
/// <summary>An opaque, short-lived browser session. It contains no raw lead or management credential.</summary>
public sealed record PublicVerificationResult(string Session);
public sealed record BrowserBookShowingRequest(long AvailabilityId, string TimeZoneId, string IdempotencyKey,
    string Session);
public sealed record BookShowingRequest(long AvailabilityId, string TimeZoneId, string IdempotencyKey,
    string? AccessToken = null);
public sealed record BookShowingResult(long ShowingId, DateTime StartsAtUtc, DateTime EndsAtUtc,
    string NotificationStatus = "pending");
public sealed record UpdateLeadRequest(LeadStatus Status, long? OwnerUserId, long? AssignedTeamMemberId,
    string? ConcurrencyToken, DateTime? NextFollowUpAtUtc);
public sealed record LeadPipelineFilter(LeadStatus? Status, long? OwnerUserId, long? ListingId,
    DateTime? FollowUpFromUtc, DateTime? FollowUpToUtc, bool? FollowUpMissing = null);
public sealed record LeadPipelineItem(long Id, long ListingId, string Name, string Email, string? Phone,
    LeadStatus Status, long? OwnerUserId, long? AssignedTeamMemberId, DateTime? NextFollowUpAtUtc,
    DateTime CreatedAtUtc, string ConcurrencyToken);
public sealed record LeadConversionMetrics(int Total, int Contacted, int Qualified, int Showings,
    int Applications, decimal InquiryToApplicationRate, int CurrentContacted = 0, int CurrentQualified = 0,
    int CurrentShowingScheduled = 0, int CurrentApplied = 0);
/// <summary>Metrics cover the full authorized organization; filters apply only to Items.</summary>
public sealed record LeadPipelineResult(IReadOnlyList<LeadPipelineItem> Items, LeadConversionMetrics Metrics);
public sealed record LeadDetail(long Id, long ListingId, long PropertyId, long? UnitId, string Name, string Email,
    string? Phone, bool ContactVerified, LeadStatus Status, long? OwnerUserId, long? AssignedTeamMemberId,
    DateTime? NextFollowUpAtUtc, long? RentalApplicationId, DateTime CreatedAtUtc, DateTime UpdatedAtUtc,
    string ConcurrencyToken, LeadPreScreenResponseDto? PreScreenResponse = null);
public sealed record LeadPreScreenResponseDto(DateOnly? MoveInDate, int? Occupants, bool? HasPets, bool? Smoking,
    string? IncomeRange, DateTime? RequestedShowingAtUtc);
public sealed record PreScreenQuestion(string Key, string Explanation, bool Optional,
    bool IsProtectedClassQuestion = false);
public sealed record PreScreenConfigurationDto(bool AskMoveInDate, bool AskOccupants, bool AskPets,
    bool AskSmoking, bool AskIncomeRange, bool AskRequestedShowingTime, string? ConcurrencyToken = null);
public sealed record PublicPreScreenCatalog(IReadOnlyList<PreScreenQuestion> Questions,
    PreScreenConfigurationDto Configuration);
public sealed record VerifyLeadContactRequest(string Token);
public sealed record AddLeadNoteRequest(string Body);
public sealed record LeadNoteDto(long Id, long AuthorUserId, string Body, DateTime CreatedAtUtc);
public sealed record AddLeadTaskRequest(string Title, long? AssigneeUserId, DateTime? DueAtUtc);
public sealed record LeadTaskDto(long Id, long? AssigneeUserId, string Title, DateTime? DueAtUtc,
    LeadTaskStatus Status, DateTime CreatedAtUtc, DateTime? CompletedAtUtc, string ConcurrencyToken);
public sealed record CompleteLeadTaskRequest(string ConcurrencyToken);
public sealed record AddShowingAvailabilityRequest(DateTimeOffset StartsAt, DateTimeOffset EndsAt,
    string TimeZoneId);
public sealed record UpdateShowingAvailabilityRequest(DateTimeOffset StartsAt, DateTimeOffset EndsAt,
    string TimeZoneId, bool IsDisabled, string ConcurrencyToken);
public sealed record ShowingAvailabilityDto(long Id, DateTime StartsAtUtc, DateTime EndsAtUtc,
    string TimeZoneId, bool IsDisabled, string ConcurrencyToken);
public sealed record CancelShowingRequest(string Token);
public sealed record ManageShowingRequest(string ManagementCode);
public sealed record ManageShowingResult(string Session, ShowingDto Showing);
public sealed record PublicCancelShowingRequest(string Session, string ConcurrencyToken);
public sealed record PublicRescheduleShowingRequest(long AvailabilityId, string TimeZoneId, string IdempotencyKey,
    string Session, string ConcurrencyToken);
public sealed record RescheduleShowingRequest(long AvailabilityId, string TimeZoneId, string IdempotencyKey,
    string? ManagementToken = null, string? ConcurrencyToken = null);
public sealed record CompleteShowingRequest(bool NoShow, string ConcurrencyToken);
public sealed record ShowingDto(long Id, long LeadId, long ListingId, long AvailabilityId,
    DateTime StartsAtUtc, DateTime EndsAtUtc, ShowingStatus Status, string ConcurrencyToken);
public sealed record ApplicationLinkDto(long ApplicationId, long LeadId, string Status);

public static class PreScreenQuestionCatalog
{
    public static readonly IReadOnlyList<PreScreenQuestion> Defaults =
    [
        new("moveInDate", "Checks whether the home's availability aligns with the prospect's timing.", true),
        new("occupants", "Helps confirm lawful occupancy limits and space needs.", true),
        new("pets", "Checks the published pet policy and related accommodations process.", true),
        new("smoking", "Checks the property's published smoke-free policy.", true),
        new("incomeRange", "Helps explain published affordability criteria without collecting documents yet.", true),
        new("requestedShowingTime", "Helps offer an available showing slot.", true)
    ];
}
