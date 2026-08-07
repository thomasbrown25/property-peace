using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Leads;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Caching.Memory;

namespace brownstone_hub_api.Services.Leads;

public interface ILeadAbuseGuard
{
    ValueTask<bool> AllowAsync(string key, CancellationToken ct);
}

public sealed class PermitAllLeadAbuseGuard : ILeadAbuseGuard
{
    public ValueTask<bool> AllowAsync(string key, CancellationToken ct) => ValueTask.FromResult(true);
}

public sealed class MemoryLeadAbuseGuard(TimeProvider clock, IMemoryCache cache) : ILeadAbuseGuard
{
    public ValueTask<bool> AllowAsync(string key, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var counter = cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            entry.Size = 1;
            return new AbuseCounter();
        })!;
        return ValueTask.FromResult(Interlocked.Increment(ref counter.Count) <= 10);
    }
    private sealed class AbuseCounter { public int Count; }
}

public class LeadException(string message) : Exception(message);
public sealed class LeadValidationException(string message) : LeadException(message);
public sealed class LeadNotFoundException : LeadException { public LeadNotFoundException() : base("Resource not found.") { } }
public sealed class LeadForbiddenException : LeadException { public LeadForbiddenException() : base("Forbidden.") { } }
public sealed class LeadConflictException(string message) : LeadException(message);
public sealed class LeadConcurrencyException : LeadException { public LeadConcurrencyException() : base("The resource changed. Refresh and retry.") { } }
public sealed class LeadRateLimitException : LeadException { public LeadRateLimitException() : base("Too many requests.") { } }

public interface ILeadService
{
    Task<PublicInquiryResult> SubmitInquiryAsync(long listingId, PublicInquiryRequest request, string abuseKey, CancellationToken ct);
    Task<long?> VerifyContactAsync(string token, string abuseKey, CancellationToken ct, long? expectedListingId = null);
    Task<PublicPreScreenCatalog> GetPublicPreScreenAsync(long listingId, CancellationToken ct);
    Task<IReadOnlyList<ShowingAvailabilityDto>> GetAvailableSlotsAsync(long listingId, DateTime fromUtc, CancellationToken ct);
    Task<BookShowingResult> BookShowingFromVerifiedSessionAsync(PublicLeadBookingAuthority authority,
        BookShowingRequest request, string abuseKey, CancellationToken ct);
    Task<BookShowingResult> BookShowingAsync(long leadId, BookShowingRequest request, long organizationId,
        string abuseKey, CancellationToken ct, long? expectedListingId = null, long actorUserId = 0);
    Task CancelPublicShowingAsync(long listingId, long showingId, string managementToken, string abuseKey, CancellationToken ct);
    Task<ShowingDto> ReschedulePublicShowingAsync(long listingId, long showingId, RescheduleShowingRequest request,
        string abuseKey, CancellationToken ct);
    Task<ShowingDto> AuthenticatePublicShowingAsync(long listingId, long showingId, string managementCode,
        string abuseKey, CancellationToken ct);
    Task CancelPublicShowingAsync(PublicShowingManagementAuthority authority, string concurrencyToken,
        string abuseKey, CancellationToken ct);
    Task<ShowingDto> ReschedulePublicShowingAsync(PublicShowingManagementAuthority authority,
        RescheduleShowingRequest request, string abuseKey, CancellationToken ct);

    Task<LeadPipelineResult> GetPipelineAsync(long organizationId, long actorUserId, LeadPipelineFilter filter, CancellationToken ct);
    Task<LeadDetail> GetLeadAsync(long organizationId, long actorUserId, long leadId, CancellationToken ct);
    Task<LeadDetail> UpdateLeadAsync(long organizationId, long actorUserId, long leadId, UpdateLeadRequest request, CancellationToken ct);
    Task AddNoteAsync(long organizationId, long actorUserId, long leadId, string body, CancellationToken ct);
    Task<IReadOnlyList<LeadNoteDto>> GetNotesAsync(long organizationId, long actorUserId, long leadId, CancellationToken ct);
    Task<LeadTaskDto> AddTaskAsync(long organizationId, long actorUserId, long leadId, string title,
        long? assigneeUserId, DateTime? dueAtUtc, CancellationToken ct);
    Task<IReadOnlyList<LeadTaskDto>> GetTasksAsync(long organizationId, long actorUserId, long leadId, CancellationToken ct);
    Task<LeadTaskDto> CompleteTaskAsync(long organizationId, long actorUserId, long leadId, long taskId,
        string concurrencyToken, CancellationToken ct);
    Task<ApplicationLinkDto> ConvertToApplicationAsync(long organizationId, long actorUserId, long leadId, CancellationToken ct);
    Task<PreScreenConfigurationDto> SetPreScreenConfigurationAsync(long organizationId, long actorUserId,
        long listingId, PreScreenConfigurationDto value, CancellationToken ct);
    Task<ShowingAvailabilityDto> AddAvailabilityAsync(long organizationId, long actorUserId, long listingId,
        DateTimeOffset starts, DateTimeOffset ends, string timeZoneId, CancellationToken ct);
    Task<ShowingAvailabilityDto> UpdateAvailabilityAsync(long organizationId, long actorUserId, long listingId,
        long availabilityId, UpdateShowingAvailabilityRequest request, CancellationToken ct);
    Task<IReadOnlyList<ShowingAvailabilityDto>> GetStaffAvailabilityAsync(long organizationId, long actorUserId,
        long listingId, CancellationToken ct);
    Task<IReadOnlyList<ShowingDto>> GetStaffShowingsAsync(long organizationId, long actorUserId,
        long? listingId, CancellationToken ct);
    Task CancelShowingAsStaffAsync(long organizationId, long actorUserId, long showingId, string concurrencyToken, CancellationToken ct);
    Task<ShowingDto> RescheduleShowingAsync(long organizationId, long actorUserId, long showingId,
        RescheduleShowingRequest request, CancellationToken ct);
    Task CompleteShowingAsync(long organizationId, long actorUserId, long showingId, bool noShow,
        string concurrencyToken, CancellationToken ct);
}

public sealed class LeadService : ILeadService
{
    private readonly DataContext db;
    private readonly ILeadAbuseGuard abuseGuard;
    private readonly TimeProvider clock;
    private readonly ILeadTokenDelivery delivery;

    private enum BookingAuthority
    {
        ManagementTokenOrStaff,
        VerifiedBrowserSession
    }

    public LeadService(DataContext db, ILeadAbuseGuard abuseGuard, TimeProvider clock, ILeadTokenDelivery delivery)
    {
        this.db = db;
        this.abuseGuard = abuseGuard;
        this.clock = clock;
        this.delivery = delivery;
    }

    public async Task<PublicInquiryResult> SubmitInquiryAsync(long listingId, PublicInquiryRequest request,
        string abuseKey, CancellationToken ct)
    {
        await GuardAsync("inquiry", listingId, abuseKey, ct);
        ValidateInquiry(request);
        var answers = request.Answers ?? throw new LeadValidationException("Pre-screen answers are required.");
        var listing = await db.Listings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == listingId &&
            x.Status == EListingStatus.Active, ct)
            ?? throw new LeadNotFoundException();
        if (listing.OrganizationId is not > 0) throw new LeadNotFoundException();

        var organizationId = listing.OrganizationId.Value;
        var config = await LoadConfigAsync(organizationId, listingId, ct);
        ValidateAnswers(config, answers);
        var normalizedEmail = NormalizeEmail(request.Email);
        var normalizedPhone = NormalizePhone(request.Phone);
        var identityHash = Hash("contact:" + normalizedEmail);
        var keyHash = Hash($"inquiry:{organizationId}:{listingId}:{request.IdempotencyKey.Trim()}");
        var requestHash = InquiryRequestHash(listingId, request, normalizedEmail, normalizedPhone);

        await using var transaction = await BeginTransactionAsync(ct);
        try
        {
            var replay = await db.LeadSources.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.IdempotencyKeyHash == keyHash, ct);
            if (replay is not null)
            {
                EnsureSameHash(replay.RequestHash, requestHash);
                await CommitAsync(transaction, ct);
                return new(replay.Receipt, "pending");
            }

            var lead = await db.Leads.SingleOrDefaultAsync(x => x.OrganizationId == organizationId &&
                x.ListingId == listingId && x.ContactIdentityHash == identityHash, ct);
            var now = clock.GetUtcNow().UtcDateTime;
            var created = lead is null;
            string? verificationToken = null;

            if (created)
            {
                verificationToken = Token();
                lead = new Lead
                {
                    OrganizationId = organizationId,
                    ListingId = listingId,
                    PropertyId = listing.PropertyId,
                    UnitId = listing.UnitId,
                    Name = request.Name.Trim(),
                    Email = request.Email.Trim(),
                    NormalizedEmail = normalizedEmail,
                    Phone = request.Phone?.Trim(),
                    NormalizedPhone = normalizedPhone,
                    ContactIdentityHash = identityHash,
                    VerificationTokenHash = PurposeHash(LeadTokenPurpose.ContactVerification, verificationToken),
                    PublicAccessTokenHash = null,
                    VerificationExpiresAtUtc = now.AddHours(24),
                    Status = LeadStatus.New,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now
                };
                db.Leads.Add(lead);
                await db.SaveChangesAsync(ct);
                db.PreScreenResponses.Add(ToResponse(organizationId, lead.Id, answers));
            }
            else if (lead.ContactVerifiedAtUtc is null && lead.VerificationExpiresAtUtc <= now)
            {
                // Expired, unverified contacts may request a fresh proof. Verified contacts never rotate credentials.
                verificationToken = Token();
                lead.VerificationTokenHash = PurposeHash(LeadTokenPurpose.ContactVerification, verificationToken);
                lead.VerificationExpiresAtUtc = now.AddHours(24);
                lead.UpdatedAtUtc = now;
            }

            var receipt = Hash($"receipt:{lead.Id}:{keyHash}:{Token()}");
            db.LeadSources.Add(new LeadSource
            {
                OrganizationId = organizationId,
                LeadId = lead.Id,
                Kind = LeadSourceKind.ListingWebsite,
                IdempotencyKeyHash = keyHash,
                RequestHash = requestHash,
                Receipt = receipt,
                AttributedAtUtc = now
            });
            if (verificationToken is not null)
            {
                await delivery.QueueAsync(new(organizationId, lead.Id, lead.NormalizedEmail,
                    LeadTokenPurpose.ContactVerification, verificationToken, now), ct);
            }

            await db.SaveChangesAsync(ct);
            await CommitAsync(transaction, ct);
            return new(receipt, "pending");
        }
        catch (DbUpdateException)
        {
            await RollbackAsync(transaction);
            db.ChangeTracker.Clear();
            var replay = await db.LeadSources.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OrganizationId == organizationId && x.IdempotencyKeyHash == keyHash, ct);
            if (replay is not null)
            {
                EnsureSameHash(replay.RequestHash, requestHash);
                return new(replay.Receipt, "pending");
            }
            throw new LeadConflictException("A concurrent inquiry conflict occurred.");
        }
    }

    public async Task<long?> VerifyContactAsync(string token, string abuseKey, CancellationToken ct,
        long? expectedListingId = null)
    {
        await GuardAsync("verify", expectedListingId ?? 0, abuseKey, ct);
        if (string.IsNullOrWhiteSpace(token)) return null;
        var hash = PurposeHash(LeadTokenPurpose.ContactVerification, token.Trim());
        var now = clock.GetUtcNow().UtcDateTime;
        await using var transaction = await BeginTransactionAsync(ct);
        var lead = await db.Leads.SingleOrDefaultAsync(x => x.VerificationTokenHash == hash &&
            (!expectedListingId.HasValue || x.ListingId == expectedListingId) &&
            db.Listings.Any(l => l.Id == x.ListingId && l.Status == EListingStatus.Active), ct);
        if (lead is null || lead.ContactVerifiedAtUtc is not null || lead.VerificationExpiresAtUtc < now)
        {
            await RollbackAsync(transaction);
            return null;
        }

        var managementToken = Token();
        lead.ContactVerifiedAtUtc = now;
        lead.VerificationTokenHash = Hash("consumed:" + Token());
        lead.PublicAccessTokenHash = PurposeHash(LeadTokenPurpose.PublicManagement, managementToken);
        lead.UpdatedAtUtc = now;
        await delivery.QueueAsync(new(lead.OrganizationId, lead.Id, lead.NormalizedEmail,
            LeadTokenPurpose.PublicManagement, managementToken, now), ct);
        await db.SaveChangesAsync(ct);
        await CommitAsync(transaction, ct);
        return lead.Id;
    }

    public async Task<PublicPreScreenCatalog> GetPublicPreScreenAsync(long listingId, CancellationToken ct)
    {
        var scope = await db.Listings.AsNoTracking().Where(x => x.Id == listingId &&
                x.OrganizationId != null && x.Status == EListingStatus.Active)
            .Select(x => new { OrganizationId = x.OrganizationId!.Value }).SingleOrDefaultAsync(ct)
            ?? throw new LeadNotFoundException();
        var config = await LoadConfigAsync(scope.OrganizationId, listingId, ct);
        return new(PreScreenQuestionCatalog.Defaults, ConfigDto(config));
    }

    public async Task<IReadOnlyList<ShowingAvailabilityDto>> GetAvailableSlotsAsync(long listingId,
        DateTime fromUtc, CancellationToken ct)
    {
        if (fromUtc.Kind != DateTimeKind.Utc)
            throw new LeadValidationException("Availability boundary must be explicit UTC.");
        if (!await db.Listings.AsNoTracking().AnyAsync(x => x.Id == listingId &&
                x.Status == EListingStatus.Active, ct))
            throw new LeadNotFoundException();
        var boundary = fromUtc > clock.GetUtcNow().UtcDateTime ? fromUtc : clock.GetUtcNow().UtcDateTime;
        return await db.ShowingAvailabilities.AsNoTracking()
            .Where(x => x.ListingId == listingId && !x.IsDisabled && x.StartsAtUtc >= boundary &&
                !db.Showings.Any(s => s.AvailabilityId == x.Id && s.Status != ShowingStatus.Cancelled))
            .OrderBy(x => x.StartsAtUtc).Take(100).Select(x => AvailabilityDto(x)).ToListAsync(ct);
    }

    public Task<BookShowingResult> BookShowingFromVerifiedSessionAsync(PublicLeadBookingAuthority authority,
        BookShowingRequest request, string abuseKey, CancellationToken ct) =>
        BookShowingCoreAsync(authority.LeadId, request, 0, abuseKey, ct, authority.ListingId, 0,
            BookingAuthority.VerifiedBrowserSession);

    public Task<BookShowingResult> BookShowingAsync(long leadId, BookShowingRequest request,
        long organizationId, string abuseKey, CancellationToken ct, long? expectedListingId = null,
        long actorUserId = 0) => BookShowingCoreAsync(leadId, request, organizationId, abuseKey, ct,
            expectedListingId, actorUserId, BookingAuthority.ManagementTokenOrStaff);

    private async Task<BookShowingResult> BookShowingCoreAsync(long leadId, BookShowingRequest request,
        long organizationId, string abuseKey, CancellationToken ct, long? expectedListingId,
        long actorUserId, BookingAuthority authority)
    {
        await GuardAsync("book", expectedListingId ?? leadId, abuseKey, ct);
        ValidateBooking(request);
        if (organizationId > 0) await AuthorizeAsync(organizationId, actorUserId, ct);
        await using var transaction = await BeginSerializableTransactionAsync(ct);
        try
        {
            var lead = await db.Leads.SingleOrDefaultAsync(x => x.Id == leadId &&
                (organizationId == 0 || x.OrganizationId == organizationId) &&
                (!expectedListingId.HasValue || x.ListingId == expectedListingId) &&
                (organizationId > 0 || db.Listings.Any(l => l.Id == x.ListingId &&
                    l.Status == EListingStatus.Active)), ct)
                ?? throw new LeadNotFoundException();
            if (organizationId == 0)
            {
                if (authority == BookingAuthority.ManagementTokenOrStaff)
                    EnsureManagementToken(lead, request.AccessToken);
                organizationId = lead.OrganizationId;
            }
            if (lead.ContactVerifiedAtUtc is null)
                throw new LeadNotFoundException();

            var keyHash = Hash($"booking:{organizationId}:{lead.Id}:{request.IdempotencyKey.Trim()}");
            var requestHash = Hash(JsonSerializer.Serialize(new
            {
                lead.Id,
                request.AvailabilityId,
                TimeZone = CanonicalTimeZone(request.TimeZoneId)
            }));
            var replay = await db.Showings.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == organizationId &&
                x.LeadId == lead.Id && x.IdempotencyKeyHash == keyHash, ct);
            if (replay is not null)
            {
                EnsureSameHash(replay.RequestHash, requestHash);
                await CommitAsync(transaction, ct);
                return BookDto(replay);
            }

            var slot = await db.ShowingAvailabilities.SingleOrDefaultAsync(x => x.Id == request.AvailabilityId &&
                x.OrganizationId == organizationId && x.ListingId == lead.ListingId && !x.IsDisabled, ct)
                ?? throw new LeadNotFoundException();
            if (slot.StartsAtUtc <= clock.GetUtcNow().UtcDateTime)
                throw new LeadConflictException("The showing slot is no longer available.");
            if (await db.Showings.AnyAsync(x => x.AvailabilityId == slot.Id && x.Status != ShowingStatus.Cancelled, ct))
                throw new LeadConflictException("The showing slot is no longer available.");

            var now = clock.GetUtcNow().UtcDateTime;
            var showing = new Showing
            {
                OrganizationId = organizationId,
                LeadId = lead.Id,
                ListingId = lead.ListingId,
                PropertyId = lead.PropertyId,
                UnitId = lead.UnitId,
                AvailabilityId = slot.Id,
                StartsAtUtc = AsUtc(slot.StartsAtUtc),
                EndsAtUtc = AsUtc(slot.EndsAtUtc),
                BoundaryTimeZoneId = CanonicalTimeZone(request.TimeZoneId),
                Status = ShowingStatus.Confirmed,
                IdempotencyKeyHash = keyHash,
                RequestHash = requestHash,
                CreatedAtUtc = now
            };
            db.Showings.Add(showing);
            lead.Status = LeadStatus.ShowingScheduled;
            lead.ShowingReachedAtUtc ??= now;
            lead.UpdatedAtUtc = now;
            await db.SaveChangesAsync(ct);
            QueueShowingIntents(showing, now, LeadNotificationKind.ShowingConfirmation);
            await db.SaveChangesAsync(ct);
            await CommitAsync(transaction, ct);
            return BookDto(showing);
        }
        catch (DbUpdateException)
        {
            await RollbackAsync(transaction);
            throw new LeadConflictException("The showing slot is no longer available.");
        }
    }

    public async Task CancelPublicShowingAsync(long listingId, long showingId, string managementToken,
        string abuseKey, CancellationToken ct)
    {
        await GuardAsync("cancel", listingId, abuseKey, ct);
        var showing = await db.Showings
            .SingleOrDefaultAsync(x => x.Id == showingId && x.ListingId == listingId &&
                db.Listings.Any(l => l.Id == x.ListingId && l.Status == EListingStatus.Active), ct)
            ?? throw new LeadNotFoundException();
        var lead = await db.Leads.SingleAsync(x => x.Id == showing.LeadId, ct);
        EnsureManagementToken(lead, managementToken);
        await CancelShowingCoreAsync(showing, null, ct);
    }

    public async Task<ShowingDto> ReschedulePublicShowingAsync(long listingId, long showingId,
        RescheduleShowingRequest request, string abuseKey, CancellationToken ct)
    {
        await GuardAsync("reschedule", listingId, abuseKey, ct);
        var showing = await db.Showings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == showingId &&
            x.ListingId == listingId && db.Listings.Any(l => l.Id == x.ListingId &&
                l.Status == EListingStatus.Active), ct) ?? throw new LeadNotFoundException();
        var lead = await db.Leads.AsNoTracking().SingleAsync(x => x.Id == showing.LeadId, ct);
        EnsureManagementToken(lead, request.ManagementToken);
        return await RescheduleCoreAsync(showing.OrganizationId, showingId, request, ct);
    }

    public async Task<ShowingDto> AuthenticatePublicShowingAsync(long listingId, long showingId,
        string managementCode, string abuseKey, CancellationToken ct)
    {
        await GuardAsync("manage", listingId, abuseKey, ct);
        var showing = await db.Showings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == showingId &&
            x.ListingId == listingId && x.Status == ShowingStatus.Confirmed &&
            db.Listings.Any(l => l.Id == x.ListingId && l.Status == EListingStatus.Active), ct)
            ?? throw new LeadNotFoundException();
        var lead = await db.Leads.AsNoTracking().SingleAsync(x => x.Id == showing.LeadId &&
            x.OrganizationId == showing.OrganizationId, ct);
        EnsureManagementToken(lead, managementCode);
        return ShowingDto(showing);
    }

    public async Task CancelPublicShowingAsync(PublicShowingManagementAuthority authority,
        string concurrencyToken, string abuseKey, CancellationToken ct)
    {
        await GuardAsync("cancel-session", authority.ListingId, abuseKey, ct);
        var showing = await db.Showings.SingleOrDefaultAsync(x => x.Id == authority.ShowingId &&
            x.ListingId == authority.ListingId && x.LeadId == authority.LeadId &&
            db.Listings.Any(l => l.Id == x.ListingId && l.Status == EListingStatus.Active), ct)
            ?? throw new LeadNotFoundException();
        await CancelShowingCoreAsync(showing, concurrencyToken, ct);
    }

    public async Task<ShowingDto> ReschedulePublicShowingAsync(PublicShowingManagementAuthority authority,
        RescheduleShowingRequest request, string abuseKey, CancellationToken ct)
    {
        await GuardAsync("reschedule-session", authority.ListingId, abuseKey, ct);
        var scoped = await db.Showings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == authority.ShowingId &&
            x.ListingId == authority.ListingId && x.LeadId == authority.LeadId &&
            db.Listings.Any(l => l.Id == x.ListingId && l.Status == EListingStatus.Active), ct)
            ?? throw new LeadNotFoundException();
        return await RescheduleCoreAsync(scoped.OrganizationId, scoped.Id, request, ct);
    }

    public async Task<LeadPipelineResult> GetPipelineAsync(long organizationId, long actorUserId,
        LeadPipelineFilter filter, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        ValidateUtcFilter(filter);
        var all = db.Leads.AsNoTracking().Where(x => x.OrganizationId == organizationId);
        var total = await all.CountAsync(ct);
        var contacted = await all.CountAsync(x => x.ContactedAtUtc != null || x.QualifiedAtUtc != null ||
            x.ShowingReachedAtUtc != null || x.AppliedAtUtc != null, ct);
        var qualified = await all.CountAsync(x => x.QualifiedAtUtc != null || x.ShowingReachedAtUtc != null ||
            x.AppliedAtUtc != null, ct);
        var showings = await all.CountAsync(x => x.ShowingReachedAtUtc != null, ct);
        var applications = await all.CountAsync(x => x.AppliedAtUtc != null || x.RentalApplicationId != null, ct);
        var currentContacted = await all.CountAsync(x => x.Status == LeadStatus.Contacted, ct);
        var currentQualified = await all.CountAsync(x => x.Status == LeadStatus.Qualified, ct);
        var currentShowing = await all.CountAsync(x => x.Status == LeadStatus.ShowingScheduled, ct);
        var currentApplied = await all.CountAsync(x => x.Status == LeadStatus.Applied, ct);
        var query = ApplyFilter(all, filter);
        var entities = await query.OrderByDescending(x => x.CreatedAtUtc).Take(200).ToListAsync(ct);
        var items = entities.Select(PipelineDto).ToList();
        return new(items, new(total, contacted, qualified, showings, applications,
            total == 0 ? 0 : Math.Round((decimal)applications / total, 4), currentContacted, currentQualified,
            currentShowing, currentApplied));
    }

    public async Task<LeadDetail> GetLeadAsync(long organizationId, long actorUserId, long leadId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var lead = await db.Leads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == leadId &&
            x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
        var response = await db.PreScreenResponses.AsNoTracking().SingleOrDefaultAsync(x =>
            x.OrganizationId == organizationId && x.LeadId == leadId, ct);
        return DetailDto(lead, response);
    }

    public async Task<LeadDetail> UpdateLeadAsync(long organizationId, long actorUserId, long leadId,
        UpdateLeadRequest request, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        if (!Enum.IsDefined(request.Status)) throw new LeadValidationException("Undefined lead status.");
        RequireUtc(request.NextFollowUpAtUtc, "Follow-up");
        var lead = await db.Leads.SingleOrDefaultAsync(x => x.Id == leadId && x.OrganizationId == organizationId, ct)
            ?? throw new LeadNotFoundException();
        if (!AllowedTransition(lead.Status, request.Status))
            throw new LeadConflictException($"Transition from {lead.Status} to {request.Status} is not allowed.");
        if (request.OwnerUserId.HasValue) await RequireOrgUserAsync(organizationId, request.OwnerUserId.Value, ct);
        if (request.AssignedTeamMemberId.HasValue) await RequireOrgUserAsync(organizationId, request.AssignedTeamMemberId.Value, ct);
        ApplyConcurrency(lead, request.ConcurrencyToken);
        lead.Status = request.Status;
        MarkReached(lead, request.Status, clock.GetUtcNow().UtcDateTime);
        lead.OwnerUserId = request.OwnerUserId;
        lead.AssignedTeamMemberId = request.AssignedTeamMemberId;
        lead.NextFollowUpAtUtc = request.NextFollowUpAtUtc;
        lead.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await SaveConcurrencyAsync(ct);
        var response = await db.PreScreenResponses.AsNoTracking().SingleOrDefaultAsync(x =>
            x.OrganizationId == organizationId && x.LeadId == leadId, ct);
        return DetailDto(lead, response);
    }

    public async Task AddNoteAsync(long organizationId, long actorUserId, long leadId, string body, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        if (string.IsNullOrWhiteSpace(body) || body.Trim().Length > 2000)
            throw new LeadValidationException("Note must be between 1 and 2000 characters.");
        await RequireLeadAsync(organizationId, leadId, ct);
        db.LeadNotes.Add(new LeadNote { OrganizationId = organizationId, LeadId = leadId,
            AuthorUserId = actorUserId, Body = body.Trim(), CreatedAtUtc = clock.GetUtcNow().UtcDateTime });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<LeadNoteDto>> GetNotesAsync(long organizationId, long actorUserId,
        long leadId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        await RequireLeadAsync(organizationId, leadId, ct);
        return await db.LeadNotes.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.LeadId == leadId)
            .OrderByDescending(x => x.CreatedAtUtc).Select(x => new LeadNoteDto(x.Id, x.AuthorUserId, x.Body, x.CreatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<LeadTaskDto> AddTaskAsync(long organizationId, long actorUserId, long leadId,
        string title, long? assigneeUserId, DateTime? dueAtUtc, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 200)
            throw new LeadValidationException("Task title must be between 1 and 200 characters.");
        RequireUtc(dueAtUtc, "Task due date");
        await RequireLeadAsync(organizationId, leadId, ct);
        if (assigneeUserId.HasValue) await RequireOrgUserAsync(organizationId, assigneeUserId.Value, ct);
        var task = new LeadTask { OrganizationId = organizationId, LeadId = leadId, Title = title.Trim(),
            AssigneeUserId = assigneeUserId, DueAtUtc = dueAtUtc, Status = LeadTaskStatus.Open,
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime };
        db.LeadTasks.Add(task);
        await db.SaveChangesAsync(ct);
        return TaskDto(task);
    }

    public async Task<IReadOnlyList<LeadTaskDto>> GetTasksAsync(long organizationId, long actorUserId,
        long leadId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        await RequireLeadAsync(organizationId, leadId, ct);
        var tasks = await db.LeadTasks.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.LeadId == leadId)
            .OrderBy(x => x.Status).ThenBy(x => x.DueAtUtc).ToListAsync(ct);
        return tasks.Select(TaskDto).ToList();
    }

    public async Task<LeadTaskDto> CompleteTaskAsync(long organizationId, long actorUserId, long leadId,
        long taskId, string concurrencyToken, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var task = await db.LeadTasks.SingleOrDefaultAsync(x => x.Id == taskId && x.LeadId == leadId &&
            x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
        ApplyConcurrency(task, concurrencyToken);
        if (task.Status != LeadTaskStatus.Open) throw new LeadConflictException("Only open tasks can be completed.");
        task.Status = LeadTaskStatus.Completed;
        task.CompletedAtUtc = clock.GetUtcNow().UtcDateTime;
        await SaveConcurrencyAsync(ct);
        return TaskDto(task);
    }

    public async Task<ApplicationLinkDto> ConvertToApplicationAsync(long organizationId, long actorUserId,
        long leadId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        await using var transaction = await BeginSerializableTransactionAsync(ct);
        try
        {
            var lead = await db.Leads.SingleOrDefaultAsync(x => x.Id == leadId && x.OrganizationId == organizationId, ct)
                ?? throw new LeadNotFoundException();
            if (lead.RentalApplicationId.HasValue)
            {
                await CommitAsync(transaction, ct);
                return new(lead.RentalApplicationId.Value, lead.Id, "draft");
            }
            if (lead.ContactVerifiedAtUtc is null)
                throw new LeadConflictException("Verified contact is required before conversion.");
            if (lead.Status is not (LeadStatus.Qualified or LeadStatus.ShowingScheduled))
                throw new LeadConflictException("Lead status is not eligible for conversion.");
            var listing = await db.Listings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == lead.ListingId &&
                x.OrganizationId == organizationId && x.PropertyId == lead.PropertyId && x.UnitId == lead.UnitId, ct)
                ?? throw new LeadConflictException("Lead listing scope is inconsistent.");
            var preScreen = await db.PreScreenResponses.AsNoTracking().SingleOrDefaultAsync(x =>
                x.OrganizationId == organizationId && x.LeadId == leadId, ct);
            var names = lead.Name.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            var application = new RentalApplication
            {
                OrganizationId = organizationId,
                PropertyId = listing.PropertyId,
                UnitId = listing.UnitId,
                LandlordId = actorUserId,
                FirstName = Bound(names.ElementAtOrDefault(0) ?? "Applicant", 100),
                LastName = Bound(names.ElementAtOrDefault(1) ?? "", 100),
                Email = Bound(lead.NormalizedEmail, 255),
                PhoneNumber = BoundOrNull(lead.NormalizedPhone, 20),
                NumberOfOccupants = preScreen?.Occupants,
                HasPets = preScreen?.HasPets ?? false,
                DesiredMoveInDate = preScreen?.MoveInDate?.ToDateTime(TimeOnly.MinValue),
                IsLandlordEntered = false,
                CreatedBy = actorUserId,
                CreatedAt = clock.GetUtcNow().UtcDateTime
            };
            db.RentalApplications.Add(application);
            await db.SaveChangesAsync(ct);
            lead.RentalApplicationId = application.Id;
            lead.Status = LeadStatus.Applied;
            lead.AppliedAtUtc ??= clock.GetUtcNow().UtcDateTime;
            lead.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
            await CommitAsync(transaction, ct);
            return new(application.Id, lead.Id, "draft");
        }
        catch (DbUpdateException)
        {
            await RollbackAsync(transaction);
            db.ChangeTracker.Clear();
            var linked = await db.Leads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == leadId &&
                x.OrganizationId == organizationId && x.RentalApplicationId != null, ct);
            if (linked?.RentalApplicationId is long id) return new(id, leadId, "draft");
            throw new LeadConflictException("Concurrent conversion conflict.");
        }
    }

    public async Task<PreScreenConfigurationDto> SetPreScreenConfigurationAsync(long organizationId,
        long actorUserId, long listingId, PreScreenConfigurationDto value, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        if (!await db.Listings.AnyAsync(x => x.Id == listingId && x.OrganizationId == organizationId, ct))
            throw new LeadNotFoundException();
        var config = await db.PreScreenConfigurations.SingleOrDefaultAsync(x => x.OrganizationId == organizationId &&
            x.ListingId == listingId, ct);
        if (config is null)
        {
            if (!string.IsNullOrWhiteSpace(value.ConcurrencyToken))
                throw new LeadConcurrencyException();
            config = new() { OrganizationId = organizationId, ListingId = listingId };
            db.Add(config);
        }
        else
        {
            ApplyConcurrency(config, value.ConcurrencyToken);
        }
        ApplyConfig(config, value);
        await SaveConcurrencyAsync(ct);
        return ConfigDto(config);
    }

    public async Task<ShowingAvailabilityDto> AddAvailabilityAsync(long organizationId, long actorUserId,
        long listingId, DateTimeOffset starts, DateTimeOffset ends, string timeZoneId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        ValidateSlot(starts, ends, timeZoneId);
        if (!await db.Listings.AnyAsync(x => x.Id == listingId && x.OrganizationId == organizationId, ct))
            throw new LeadNotFoundException();
        await EnsureNoOverlapAsync(organizationId, listingId, starts.UtcDateTime, ends.UtcDateTime, null, ct);
        var slot = new ShowingAvailability { OrganizationId = organizationId, ListingId = listingId,
            StartsAtUtc = starts.UtcDateTime, EndsAtUtc = ends.UtcDateTime,
            TimeZoneId = CanonicalTimeZone(timeZoneId) };
        db.Add(slot);
        await db.SaveChangesAsync(ct);
        return AvailabilityDto(slot);
    }

    public async Task<ShowingAvailabilityDto> UpdateAvailabilityAsync(long organizationId, long actorUserId,
        long listingId, long availabilityId, UpdateShowingAvailabilityRequest request, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        ValidateSlot(request.StartsAt, request.EndsAt, request.TimeZoneId);
        var slot = await db.ShowingAvailabilities.SingleOrDefaultAsync(x => x.Id == availabilityId &&
            x.ListingId == listingId && x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
        ApplyConcurrency(slot, request.ConcurrencyToken);
        if (!request.IsDisabled)
            await EnsureNoOverlapAsync(organizationId, listingId, request.StartsAt.UtcDateTime,
                request.EndsAt.UtcDateTime, slot.Id, ct);
        slot.StartsAtUtc = request.StartsAt.UtcDateTime;
        slot.EndsAtUtc = request.EndsAt.UtcDateTime;
        slot.TimeZoneId = CanonicalTimeZone(request.TimeZoneId);
        slot.IsDisabled = request.IsDisabled;
        await SaveConcurrencyAsync(ct);
        return AvailabilityDto(slot);
    }

    public async Task<IReadOnlyList<ShowingAvailabilityDto>> GetStaffAvailabilityAsync(long organizationId,
        long actorUserId, long listingId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        if (!await db.Listings.AsNoTracking().AnyAsync(x => x.Id == listingId && x.OrganizationId == organizationId, ct))
            throw new LeadNotFoundException();
        var values = await db.ShowingAvailabilities.AsNoTracking().Where(x => x.OrganizationId == organizationId &&
            x.ListingId == listingId).OrderBy(x => x.StartsAtUtc).ToListAsync(ct);
        return values.Select(AvailabilityDto).ToList();
    }

    public async Task<IReadOnlyList<ShowingDto>> GetStaffShowingsAsync(long organizationId, long actorUserId,
        long? listingId, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var query = db.Showings.AsNoTracking().Where(x => x.OrganizationId == organizationId);
        if (listingId.HasValue) query = query.Where(x => x.ListingId == listingId.Value);
        var values = await query.OrderBy(x => x.StartsAtUtc).Take(500).ToListAsync(ct);
        return values.Select(ShowingDto).ToList();
    }

    public async Task CancelShowingAsStaffAsync(long organizationId, long actorUserId, long showingId,
        string concurrencyToken, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        var showing = await db.Showings.SingleOrDefaultAsync(x => x.Id == showingId &&
            x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
        await CancelShowingCoreAsync(showing, concurrencyToken, ct);
    }

    public async Task<ShowingDto> RescheduleShowingAsync(long organizationId, long actorUserId, long showingId,
        RescheduleShowingRequest request, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        return await RescheduleCoreAsync(organizationId, showingId, request, ct);
    }

    public async Task CompleteShowingAsync(long organizationId, long actorUserId, long showingId, bool noShow,
        string concurrencyToken, CancellationToken ct)
    {
        await AuthorizeAsync(organizationId, actorUserId, ct);
        await using var transaction = await BeginTransactionAsync(ct);
        var showing = await db.Showings.SingleOrDefaultAsync(x => x.Id == showingId &&
            x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
        ApplyConcurrency(showing, concurrencyToken);
        if (showing.Status != ShowingStatus.Confirmed)
            throw new LeadConflictException("Only confirmed showings can be completed.");
        showing.Status = noShow ? ShowingStatus.NoShow : ShowingStatus.Completed;
        var lead = await db.Leads.SingleAsync(x => x.Id == showing.LeadId, ct);
        if (lead.Status == LeadStatus.ShowingScheduled) lead.Status = LeadStatus.Qualified;
        lead.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await SaveConcurrencyAsync(ct);
        await CommitAsync(transaction, ct);
    }

    private async Task<ShowingDto> RescheduleCoreAsync(long organizationId, long showingId,
        RescheduleShowingRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            throw new LeadValidationException("Idempotency key is required.");
        var zone = CanonicalTimeZone(request.TimeZoneId);
        await using var transaction = await BeginSerializableTransactionAsync(ct);
        try
        {
            var showing = await db.Showings.SingleOrDefaultAsync(x => x.Id == showingId &&
                x.OrganizationId == organizationId, ct) ?? throw new LeadNotFoundException();
            var keyHash = Hash($"reschedule:{organizationId}:{showing.Id}:{request.IdempotencyKey.Trim()}");
            var requestHash = Hash(JsonSerializer.Serialize(new { showing.Id, request.AvailabilityId, TimeZone = zone }));
            var prior = await db.ShowingOperations.AsNoTracking().SingleOrDefaultAsync(x =>
                x.OrganizationId == organizationId && x.IdempotencyKeyHash == keyHash, ct);
            if (prior is not null)
            {
                if (prior.ShowingId != showing.Id)
                    throw new LeadConflictException("The idempotency key was already used.");
                EnsureSameHash(prior.RequestHash, requestHash);
                await CommitAsync(transaction, ct);
                return new(prior.ShowingId, showing.LeadId, showing.ListingId, prior.ResultAvailabilityId,
                    prior.ResultStartsAtUtc, prior.ResultEndsAtUtc, prior.ResultStatus, ETag(showing.RowVersion));
            }
            ApplyConcurrency(showing, request.ConcurrencyToken);
            if (showing.Status != ShowingStatus.Confirmed)
                throw new LeadConflictException("Only confirmed showings can be rescheduled.");
            var slot = await db.ShowingAvailabilities.SingleOrDefaultAsync(x => x.Id == request.AvailabilityId &&
                x.OrganizationId == organizationId && x.ListingId == showing.ListingId && !x.IsDisabled, ct)
                ?? throw new LeadNotFoundException();
            if (slot.StartsAtUtc <= clock.GetUtcNow().UtcDateTime || await db.Showings.AnyAsync(x => x.Id != showing.Id &&
                x.AvailabilityId == slot.Id && x.Status != ShowingStatus.Cancelled, ct))
                throw new LeadConflictException("The showing slot is no longer available.");
            CancelPendingReminders(showing.Id);
            showing.AvailabilityId = slot.Id;
            showing.StartsAtUtc = AsUtc(slot.StartsAtUtc);
            showing.EndsAtUtc = AsUtc(slot.EndsAtUtc);
            showing.BoundaryTimeZoneId = zone;
            showing.RescheduleIdempotencyKeyHash = keyHash;
            showing.RescheduleRequestHash = requestHash;
            var now = clock.GetUtcNow().UtcDateTime;
            db.ShowingOperations.Add(new ShowingOperation { OrganizationId = organizationId, ShowingId = showing.Id,
                Operation = "reschedule", IdempotencyKeyHash = keyHash, RequestHash = requestHash,
                ResultAvailabilityId = slot.Id, ResultStartsAtUtc = showing.StartsAtUtc,
                ResultEndsAtUtc = showing.EndsAtUtc, ResultTimeZoneId = zone,
                ResultStatus = ShowingStatus.Confirmed, CreatedAtUtc = now });
            QueueShowingIntents(showing, now, LeadNotificationKind.ShowingRescheduled);
            await SaveConcurrencyAsync(ct);
            await CommitAsync(transaction, ct);
            return ShowingDto(showing);
        }
        catch (DbUpdateException)
        {
            await RollbackAsync(transaction);
            throw new LeadConflictException("The showing slot is no longer available.");
        }
    }

    private async Task CancelShowingCoreAsync(Showing showing, string? concurrencyToken, CancellationToken ct)
    {
        await using var transaction = await BeginTransactionAsync(ct);
        if (concurrencyToken is not null) ApplyConcurrency(showing, concurrencyToken);
        if (showing.Status == ShowingStatus.Cancelled)
        {
            await CommitAsync(transaction, ct);
            return;
        }
        if (showing.Status != ShowingStatus.Confirmed)
            throw new LeadConflictException("Only confirmed showings can be cancelled.");
        var now = clock.GetUtcNow().UtcDateTime;
        showing.Status = ShowingStatus.Cancelled;
        showing.CancelledAtUtc = now;
        CancelPendingReminders(showing.Id);
        db.LeadNotificationIntents.Add(new() { OrganizationId = showing.OrganizationId, LeadId = showing.LeadId,
            ShowingId = showing.Id, Kind = LeadNotificationKind.ShowingCancellation,
            Status = NotificationIntentStatus.Pending, NotBeforeUtc = now, CreatedAtUtc = now });
        var lead = await db.Leads.SingleAsync(x => x.Id == showing.LeadId, ct);
        var hasOther = await db.Showings.AnyAsync(x => x.LeadId == lead.Id && x.Id != showing.Id &&
            x.Status == ShowingStatus.Confirmed, ct);
        if (!hasOther && lead.Status == LeadStatus.ShowingScheduled) lead.Status = LeadStatus.Qualified;
        lead.UpdatedAtUtc = now;
        await SaveConcurrencyAsync(ct);
        await CommitAsync(transaction, ct);
    }

    private void CancelPendingReminders(long showingId)
    {
        foreach (var intent in db.LeadNotificationIntents.Where(x => x.ShowingId == showingId &&
                     x.Kind == LeadNotificationKind.ShowingReminder && x.Status == NotificationIntentStatus.Pending))
            intent.Status = NotificationIntentStatus.Cancelled;
    }

    private void QueueShowingIntents(Showing showing, DateTime now, LeadNotificationKind eventKind)
    {
        db.LeadNotificationIntents.AddRange(
            new LeadNotificationIntent { OrganizationId = showing.OrganizationId, LeadId = showing.LeadId,
                ShowingId = showing.Id, Kind = eventKind, Status = NotificationIntentStatus.Pending,
                NotBeforeUtc = now, CreatedAtUtc = now },
            new LeadNotificationIntent { OrganizationId = showing.OrganizationId, LeadId = showing.LeadId,
                ShowingId = showing.Id, Kind = LeadNotificationKind.ShowingReminder,
                Status = NotificationIntentStatus.Pending,
                NotBeforeUtc = showing.StartsAtUtc.AddHours(-24) > now ? showing.StartsAtUtc.AddHours(-24) : now,
                CreatedAtUtc = now });
    }

    private async Task AuthorizeAsync(long organizationId, long actorUserId, CancellationToken ct)
    {
        if (organizationId <= 0 || actorUserId <= 0) throw new LeadForbiddenException();
        var owner = await db.Organizations.AsNoTracking().AnyAsync(x => x.Id == organizationId &&
            x.OwnerId == actorUserId, ct);
        var member = await db.OrganizationMembers.AsNoTracking().AnyAsync(x => x.OrganizationId == organizationId &&
            x.UserId == actorUserId && x.IsActive, ct);
        if (!owner && !member) throw new LeadForbiddenException();
    }

    private async Task RequireOrgUserAsync(long organizationId, long userId, CancellationToken ct)
    {
        try { await AuthorizeAsync(organizationId, userId, ct); }
        catch (LeadForbiddenException) { throw new LeadValidationException("Assignment must be an active organization member."); }
    }

    private async Task RequireLeadAsync(long organizationId, long leadId, CancellationToken ct)
    {
        if (!await db.Leads.AsNoTracking().AnyAsync(x => x.Id == leadId && x.OrganizationId == organizationId, ct))
            throw new LeadNotFoundException();
    }

    private async Task GuardAsync(string operation, long subject, string abuseKey, CancellationToken ct)
    {
        if (!await abuseGuard.AllowAsync($"{operation}:{subject}:{abuseKey}", ct))
            throw new LeadRateLimitException();
    }

    private void EnsureManagementToken(Lead lead, string? token)
    {
        if (lead.ContactVerifiedAtUtc is null || string.IsNullOrWhiteSpace(lead.PublicAccessTokenHash) ||
            string.IsNullOrWhiteSpace(token) || !FixedHashEquals(lead.PublicAccessTokenHash,
                PurposeHash(LeadTokenPurpose.PublicManagement, token.Trim())))
            throw new LeadNotFoundException();
    }

    private async Task<PreScreenConfiguration> LoadConfigAsync(long organizationId, long listingId, CancellationToken ct) =>
        await db.PreScreenConfigurations.AsNoTracking().SingleOrDefaultAsync(x => x.OrganizationId == organizationId &&
            x.ListingId == listingId, ct) ?? new() { OrganizationId = organizationId, ListingId = listingId };

    private async Task EnsureNoOverlapAsync(long organizationId, long listingId, DateTime start, DateTime end,
        long? exceptId, CancellationToken ct)
    {
        if (await db.ShowingAvailabilities.AnyAsync(x => x.OrganizationId == organizationId &&
            x.ListingId == listingId && !x.IsDisabled && x.Id != exceptId && start < x.EndsAtUtc && end > x.StartsAtUtc, ct))
            throw new LeadConflictException("Availability slots cannot overlap.");
    }

    private async Task<IDbContextTransaction?> BeginTransactionAsync(CancellationToken ct) =>
        db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
    private async Task<IDbContextTransaction?> BeginSerializableTransactionAsync(CancellationToken ct) =>
        db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
    private static Task CommitAsync(IDbContextTransaction? transaction, CancellationToken ct) =>
        transaction?.CommitAsync(ct) ?? Task.CompletedTask;
    private static Task RollbackAsync(IDbContextTransaction? transaction) =>
        transaction?.RollbackAsync(CancellationToken.None) ?? Task.CompletedTask;

    private async Task SaveConcurrencyAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new LeadConcurrencyException(); }
    }

    private void ApplyConcurrency<TEntity>(TEntity entity, string? token) where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new LeadValidationException("A concurrency token is required.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(token.Trim().Trim('"')); }
        catch (FormatException) { throw new LeadValidationException("The concurrency token is invalid."); }
        if (bytes.Length == 0) throw new LeadValidationException("The concurrency token is invalid.");
        var property = db.Entry(entity).Property("RowVersion");
        // SQL Server always supplies a non-empty rowversion. EF's in-memory provider leaves new
        // rowversions empty, which ETag represents with a one-byte sentinel for test/API parity.
        if (bytes.Length == 1 && bytes[0] == 0 && property.CurrentValue is byte[] current && current.Length == 0)
            bytes = [];
        property.OriginalValue = bytes;
    }

    private static bool AllowedTransition(LeadStatus from, LeadStatus to) => from == to || (from, to) switch
    {
        (LeadStatus.New, LeadStatus.Contacted or LeadStatus.Qualified or LeadStatus.Lost) => true,
        (LeadStatus.Contacted, LeadStatus.Qualified or LeadStatus.Lost) => true,
        (LeadStatus.Qualified, LeadStatus.ShowingScheduled or LeadStatus.Applied or LeadStatus.Lost) => true,
        (LeadStatus.ShowingScheduled, LeadStatus.Qualified or LeadStatus.Applied or LeadStatus.Lost) => true,
        (LeadStatus.Lost, LeadStatus.New) => true,
        _ => false
    };

    private static IQueryable<Lead> ApplyFilter(IQueryable<Lead> query, LeadPipelineFilter filter)
    {
        if (filter.Status.HasValue) query = query.Where(x => x.Status == filter.Status);
        if (filter.OwnerUserId.HasValue) query = query.Where(x => x.OwnerUserId == filter.OwnerUserId);
        if (filter.ListingId.HasValue) query = query.Where(x => x.ListingId == filter.ListingId);
        if (filter.FollowUpFromUtc.HasValue) query = query.Where(x => x.NextFollowUpAtUtc >= filter.FollowUpFromUtc);
        if (filter.FollowUpToUtc.HasValue) query = query.Where(x => x.NextFollowUpAtUtc <= filter.FollowUpToUtc);
        if (filter.FollowUpMissing == true) query = query.Where(x => x.NextFollowUpAtUtc == null);
        return query;
    }

    private static void ValidateUtcFilter(LeadPipelineFilter filter)
    {
        RequireUtc(filter.FollowUpFromUtc, "Follow-up from");
        RequireUtc(filter.FollowUpToUtc, "Follow-up to");
    }

    private static void ValidateInquiry(PublicInquiryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 200)
            throw new LeadValidationException("Name is required and bounded.");
        if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Trim().Length > 320 ||
            !request.Email.Contains('@', StringComparison.Ordinal))
            throw new LeadValidationException("Valid email required.");
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 200)
            throw new LeadValidationException("Idempotency key required.");
        if (request.Answers is null) throw new LeadValidationException("Pre-screen answers are required.");
        if (request.Answers.Occupants is < 1 or > 50) throw new LeadValidationException("Occupants out of range.");
        if (request.Answers.IncomeRange?.Trim().Length > 30) throw new LeadValidationException("Income range too long.");
    }

    private static void ValidateAnswers(PreScreenConfiguration config, PreScreenAnswers answers)
    {
        if ((!config.AskPets && answers.HasPets.HasValue) || (!config.AskSmoking && answers.Smoking.HasValue) ||
            (!config.AskMoveInDate && answers.MoveInDate.HasValue) || (!config.AskOccupants && answers.Occupants.HasValue) ||
            (!config.AskIncomeRange && answers.IncomeRange is not null) ||
            (!config.AskRequestedShowingTime && answers.RequestedShowingTime.HasValue))
            throw new LeadValidationException("A disabled pre-screen question was submitted.");
    }

    private void ValidateSlot(DateTimeOffset starts, DateTimeOffset ends, string timeZoneId)
    {
        _ = CanonicalTimeZone(timeZoneId);
        if (ends <= starts || starts.UtcDateTime <= clock.GetUtcNow().UtcDateTime)
            throw new LeadValidationException("A future chronological slot is required.");
        if (ends - starts > TimeSpan.FromHours(8))
            throw new LeadValidationException("Availability slot is too long.");
    }

    private static void ValidateBooking(BookShowingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey) || request.IdempotencyKey.Length > 200)
            throw new LeadValidationException("Idempotency key is required.");
        _ = CanonicalTimeZone(request.TimeZoneId);
    }

    private static void RequireUtc(DateTime? value, string field)
    {
        if (value.HasValue && value.Value.Kind != DateTimeKind.Utc)
            throw new LeadValidationException($"{field} must be explicit UTC.");
    }

    private static string CanonicalTimeZone(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) throw new LeadValidationException("A valid time zone is required.");
        if (TimeZoneInfo.TryFindSystemTimeZoneById(id.Trim(), out var zone)) return zone.Id;
        if (TimeZoneInfo.TryConvertWindowsIdToIanaId(id.Trim(), out var iana) &&
            TimeZoneInfo.TryFindSystemTimeZoneById(iana, out zone)) return zone.Id;
        throw new LeadValidationException("A valid time zone is required.");
    }

    private static string InquiryRequestHash(long listingId, PublicInquiryRequest request, string email, string? phone) =>
        Hash(JsonSerializer.Serialize(new { ListingId = listingId, Name = request.Name.Trim(), Email = email,
            Phone = phone, Source = LeadSourceKind.ListingWebsite, Answers = request.Answers }));
    private static void EnsureSameHash(string stored, string current)
    {
        if (!FixedHashEquals(stored, current))
            throw new LeadConflictException("The idempotency key was already used with a different payload.");
    }

    private static PreScreenResponse ToResponse(long organizationId, long leadId, PreScreenAnswers answers) => new()
    {
        OrganizationId = organizationId, LeadId = leadId, MoveInDate = answers.MoveInDate,
        Occupants = answers.Occupants, HasPets = answers.HasPets, Smoking = answers.Smoking,
        IncomeRange = answers.IncomeRange?.Trim(), RequestedShowingAtUtc = answers.RequestedShowingTime?.UtcDateTime
    };

    private static void MarkReached(Lead lead, LeadStatus status, DateTime now)
    {
        if (status >= LeadStatus.Contacted && status != LeadStatus.Lost) lead.ContactedAtUtc ??= now;
        if (status >= LeadStatus.Qualified && status != LeadStatus.Lost) lead.QualifiedAtUtc ??= now;
        if (status == LeadStatus.ShowingScheduled) lead.ShowingReachedAtUtc ??= now;
        if (status == LeadStatus.Applied) lead.AppliedAtUtc ??= now;
    }
    private static BookShowingResult BookDto(Showing x) => new(x.Id, x.StartsAtUtc, x.EndsAtUtc);
    private static ShowingDto ShowingDto(Showing x) => new(x.Id, x.LeadId, x.ListingId, x.AvailabilityId,
        x.StartsAtUtc, x.EndsAtUtc, x.Status, ETag(x.RowVersion));
    private static ShowingAvailabilityDto AvailabilityDto(ShowingAvailability x) => new(x.Id, x.StartsAtUtc,
        x.EndsAtUtc, x.TimeZoneId, x.IsDisabled, ETag(x.RowVersion));
    private static LeadTaskDto TaskDto(LeadTask x) => new(x.Id, x.AssigneeUserId, x.Title, x.DueAtUtc,
        x.Status, x.CreatedAtUtc, x.CompletedAtUtc, ETag(x.RowVersion));
    private static LeadPipelineItem PipelineDto(Lead x) => new(x.Id, x.ListingId, x.Name, x.Email, x.Phone,
        x.Status, x.OwnerUserId, x.AssignedTeamMemberId, x.NextFollowUpAtUtc, x.CreatedAtUtc, ETag(x.RowVersion));
    private static LeadDetail DetailDto(Lead x, PreScreenResponse? response = null) => new(x.Id, x.ListingId, x.PropertyId, x.UnitId, x.Name,
        x.Email, x.Phone, x.ContactVerifiedAtUtc.HasValue, x.Status, x.OwnerUserId, x.AssignedTeamMemberId,
        x.NextFollowUpAtUtc, x.RentalApplicationId, x.CreatedAtUtc, x.UpdatedAtUtc, ETag(x.RowVersion),
        response is null ? null : new(response.MoveInDate, response.Occupants, response.HasPets, response.Smoking,
            response.IncomeRange, response.RequestedShowingAtUtc));
    private static PreScreenConfigurationDto ConfigDto(PreScreenConfiguration x) => new(x.AskMoveInDate,
        x.AskOccupants, x.AskPets, x.AskSmoking, x.AskIncomeRange, x.AskRequestedShowingTime, ETag(x.RowVersion));
    private static void ApplyConfig(PreScreenConfiguration x, PreScreenConfigurationDto value)
    {
        x.AskMoveInDate = value.AskMoveInDate; x.AskOccupants = value.AskOccupants;
        x.AskPets = value.AskPets; x.AskSmoking = value.AskSmoking;
        x.AskIncomeRange = value.AskIncomeRange; x.AskRequestedShowingTime = value.AskRequestedShowingTime;
    }

    private static string ETag(byte[] value) => Convert.ToBase64String(value.Length == 0 ? [0] : value);
    private static string NormalizeEmail(string value) => value.Trim().ToLowerInvariant();
    private static string? NormalizePhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length == 10) return "+1" + digits;
        return digits.Length is >= 7 and <= 15 ? "+" + digits : throw new LeadValidationException("Phone number is invalid.");
    }
    private static string Bound(string value, int length) => value.Length <= length ? value : value[..length];
    private static string? BoundOrNull(string? value, int length) => value is null ? null : Bound(value, length);
    private static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    private static string PurposeHash(LeadTokenPurpose purpose, string token) => Hash($"lead:{purpose}:{token}");
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    private static bool FixedHashEquals(string left, string right) => left.Length == right.Length &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(left), Encoding.ASCII.GetBytes(right));
    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
