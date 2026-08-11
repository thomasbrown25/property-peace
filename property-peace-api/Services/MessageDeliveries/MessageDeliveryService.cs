using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.MessageDeliveries;

public sealed record DeliveryTarget(MessageDeliveryChannel Channel, long? RecipientUserId, string? Destination,
    string Body = "", string? Subject = null, string? HtmlBody = null, string? FromAddress = null);

public sealed record MessageDeliveryView(
    long Id,
    MessageDeliveryChannel Channel,
    MessageDeliveryStatus Status,
    long? RecipientUserId,
    DateTime CreatedAtUtc,
    DateTime? SubmittedAtUtc,
    DateTime? DeliveredAtUtc,
    DateTime? FailedAtUtc,
    string? MaskedDestination,
    string? Provider,
    string? ProviderMessageId,
    int? AttemptCount,
    DateTime? NextAttemptAtUtc,
    string? ErrorCode,
    string? ErrorDetail);

public interface ICommunicationDestinationProtector
{
    string Protect(string destination);
    string Unprotect(string protectedDestination);
}

public sealed class DataProtectionCommunicationDestinationProtector(IDataProtectionProvider provider)
    : ICommunicationDestinationProtector
{
    private readonly IDataProtector protector = provider.CreateProtector("communication-destination-v1");
    public string Protect(string destination) => protector.Protect(destination);
    public string Unprotect(string protectedDestination) => protector.Unprotect(protectedDestination);
}

public interface IMessageDeliveryService
{
    Task<IReadOnlyList<MessageDelivery>> CreateAsync(long organizationId, long conversationId,
        long timelineEntryId, long? messageId, string idempotencyKey, IReadOnlyCollection<DeliveryTarget> targets,
        CancellationToken ct = default);
    Task<IReadOnlyList<MessageDelivery>> LeaseDueAsync(int take, Guid leaseId, TimeSpan leaseDuration, CancellationToken ct = default);
    Task<MessageDelivery> RecordSubmissionStartedAsync(long deliveryId, Guid leaseId, CancellationToken ct = default);
    Task<MessageDelivery> RecordSubmittedAsync(long deliveryId, Guid? leaseId, string provider, string providerMessageId, CancellationToken ct = default);
    Task<MessageDelivery> RecordDeliveredAsync(long deliveryId, string provider, string providerMessageId, CancellationToken ct = default);
    Task<MessageDelivery> RecordFailedAsync(long deliveryId, string errorCode, string? detail, bool retryable, TimeSpan? retryDelay, CancellationToken ct = default);
    Task<MessageDelivery> ManualRetryAsync(long deliveryId, CancellationToken ct = default);
    Task<bool> RecordProviderStatusAsync(string provider, string providerMessageId, string status,
        string? errorCode = null, string? errorDetail = null, CancellationToken ct = default);
    Task<IReadOnlyList<MessageDeliveryView>> ReadForConversationAsync(long conversationId, long actorUserId, CancellationToken ct = default);
}

public sealed class MessageDeliveryService(
    DataContext context,
    ICommunicationDestinationProtector destinationProtector,
    TimeProvider clock) : IMessageDeliveryService
{
    public async Task<IReadOnlyList<MessageDelivery>> CreateAsync(
        long organizationId,
        long conversationId,
        long timelineEntryId,
        long? messageId,
        string idempotencyKey,
        IReadOnlyCollection<DeliveryTarget> targets,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyKey);
        if (targets.Count == 0) throw new ArgumentException("At least one delivery target is required.", nameof(targets));

        var timelineExists = await context.ConversationTimelineEntries.AnyAsync(x =>
            x.Id == timelineEntryId && x.OrganizationId == organizationId && x.ConversationId == conversationId, ct);
        if (!timelineExists) throw new KeyNotFoundException("Timeline entry was not found in the organization conversation.");
        if (messageId.HasValue && !await context.Messages.AnyAsync(x =>
                x.Id == messageId && x.OrganizationId == organizationId && x.ConversationId == conversationId, ct))
            throw new KeyNotFoundException("Message was not found in the organization conversation.");

        var uniqueTargets = targets.GroupBy(x => (x.Channel, x.RecipientUserId)).ToArray();
        if (uniqueTargets.Any(x => x.Count() != 1))
            throw new ArgumentException("A channel/recipient pair may only be requested once.", nameof(targets));

        var operationDigest = Hash(idempotencyKey.Trim());
        var normalizedTargets = targets.Select(target => (Target: target, Destination: NormalizeDestination(target))).ToArray();
        var keys = normalizedTargets.Select(x => BuildKey(operationDigest,
            BuildPayloadIdentityHash(organizationId, conversationId, timelineEntryId, messageId, x.Target))).ToArray();
        var existing = await context.MessageDeliveries
            .Where(x => x.OrganizationId == organizationId && x.IdempotencyKey.StartsWith(operationDigest + ":"))
            .ToListAsync(ct);
        if (existing.Count > 0)
        {
            if (!TryMatchExisting(existing, normalizedTargets, timelineEntryId, messageId, out var matched))
                throw new InvalidOperationException("The idempotency key was already used for a different payload.");
            return matched;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var deliveries = targets.Select((target, index) => CreateDelivery(
            organizationId, timelineEntryId, messageId, target, keys[index], now)).ToArray();
        context.MessageDeliveries.AddRange(deliveries);
        try
        {
            // One SaveChanges transaction makes the requested set all-or-nothing on the relational provider.
            await context.SaveChangesAsync(ct);
            return deliveries;
        }
        catch (DbUpdateException)
        {
            // A concurrent request may have won the organization-scoped unique keys. Treat a complete
            // matching set as the same idempotent operation rather than creating duplicate evidence.
            foreach (var delivery in deliveries) context.Entry(delivery).State = EntityState.Detached;
            var winner = await context.MessageDeliveries.AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && x.IdempotencyKey.StartsWith(operationDigest + ":"))
                .ToListAsync(ct);
            if (TryMatchExisting(winner, normalizedTargets, timelineEntryId, messageId, out var matched))
                return matched;
            throw new InvalidOperationException("The idempotency key was already used for a different payload.");
        }
    }

    public async Task<IReadOnlyList<MessageDelivery>> LeaseDueAsync(
        int take,
        Guid leaseId,
        TimeSpan leaseDuration,
        CancellationToken ct = default)
    {
        if (take is < 1 or > 500) throw new ArgumentOutOfRangeException(nameof(take));
        if (leaseId == Guid.Empty) throw new ArgumentException("Lease ID is required.", nameof(leaseId));
        if (leaseDuration <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(leaseDuration));

        var now = clock.GetUtcNow().UtcDateTime;
        var due = await context.MessageDeliveries
            .Where(x => x.Channel != MessageDeliveryChannel.InApp &&
                (x.Status == MessageDeliveryStatus.Pending || x.Status == MessageDeliveryStatus.Failed ||
                 x.Status == MessageDeliveryStatus.Leased && x.ProcessingLeaseUntilUtc <= now) &&
                (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now))
            .OrderBy(x => x.NextAttemptAtUtc).ThenBy(x => x.Id)
            .Take(take)
            .ToListAsync(ct);

        foreach (var delivery in due)
        {
            delivery.Status = MessageDeliveryStatus.Leased;
            delivery.ProcessingLeaseId = leaseId;
            delivery.ProcessingLeaseUntilUtc = now.Add(leaseDuration);
            delivery.AttemptCount++;
            delivery.UpdatedAtUtc = now;
        }

        try
        {
            await context.SaveChangesAsync(ct);
            return due;
        }
        catch (DbUpdateConcurrencyException)
        {
            // Rowversion makes competing claims fail rather than allowing two valid leases.
            foreach (var entry in context.ChangeTracker.Entries<MessageDelivery>().Where(x => x.State == EntityState.Modified))
                entry.State = EntityState.Detached;
            return [];
        }
    }

    /// <summary>
    /// Commits the at-most-once boundary before entering provider code. Providers currently used by
    /// this worker do not offer a reliable application idempotency key. If the process dies after this
    /// state is saved, Submitting is intentionally not re-leased; its outcome must be reconciled.
    /// </summary>
    public async Task<MessageDelivery> RecordSubmissionStartedAsync(
        long deliveryId, Guid leaseId, CancellationToken ct = default)
    {
        var delivery = await FindAsync(deliveryId, ct);
        if (delivery.Status == MessageDeliveryStatus.Submitting) return delivery;
        if (delivery.Status != MessageDeliveryStatus.Leased || delivery.ProcessingLeaseId != leaseId)
            throw new DbUpdateConcurrencyException("The delivery lease is no longer owned by this operation.");

        delivery.Status = MessageDeliveryStatus.Submitting;
        delivery.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync(ct);
        return delivery;
    }

    public async Task<MessageDelivery> RecordSubmittedAsync(
        long deliveryId, Guid? leaseId, string provider, string providerMessageId, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(provider);
        ArgumentException.ThrowIfNullOrWhiteSpace(providerMessageId);
        var delivery = await FindAsync(deliveryId, ct);
        if (delivery.Status is MessageDeliveryStatus.Delivered or MessageDeliveryStatus.DeadLettered or MessageDeliveryStatus.Suppressed)
            return delivery;
        if (delivery.Status == MessageDeliveryStatus.Submitted &&
            string.Equals(delivery.Provider, provider.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(delivery.ProviderMessageId, providerMessageId.Trim(), StringComparison.Ordinal))
            return delivery;
        if (leaseId.HasValue && delivery.ProcessingLeaseId != leaseId)
            throw new DbUpdateConcurrencyException("The delivery lease is no longer owned by this operation.");

        EnsureProviderIdentity(delivery, provider, providerMessageId);
        delivery.Provider = provider.Trim();
        delivery.ProviderMessageId = providerMessageId.Trim();
        delivery.Status = MessageDeliveryStatus.Submitted;
        delivery.SubmittedAtUtc ??= clock.GetUtcNow().UtcDateTime;
        ClearLease(delivery);
        delivery.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync(ct);
        return delivery;
    }

    public async Task<MessageDelivery> RecordDeliveredAsync(
        long deliveryId, string provider, string providerMessageId, CancellationToken ct = default)
    {
        var delivery = await FindAsync(deliveryId, ct);
        if (delivery.Status is MessageDeliveryStatus.Delivered or MessageDeliveryStatus.Suppressed) return delivery;
        EnsureProviderIdentity(delivery, provider, providerMessageId);
        delivery.Provider = provider.Trim();
        delivery.ProviderMessageId = providerMessageId.Trim();
        delivery.Status = MessageDeliveryStatus.Delivered;
        delivery.DeliveredAtUtc ??= clock.GetUtcNow().UtcDateTime;
        delivery.NextAttemptAtUtc = null;
        delivery.ErrorCode = null;
        delivery.ErrorDetail = null;
        ClearLease(delivery);
        delivery.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync(ct);
        return delivery;
    }

    public async Task<MessageDelivery> RecordFailedAsync(
        long deliveryId,
        string errorCode,
        string? detail,
        bool retryable,
        TimeSpan? retryDelay,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorCode);
        if (retryable && (!retryDelay.HasValue || retryDelay <= TimeSpan.Zero))
            throw new ArgumentException("A positive retry delay is required for retryable failures.", nameof(retryDelay));
        var delivery = await FindAsync(deliveryId, ct);
        if (delivery.Status is MessageDeliveryStatus.Delivered or MessageDeliveryStatus.Suppressed or MessageDeliveryStatus.DeadLettered)
            return delivery;
        // A retryable failure remains parked until its due lease. Replayed callbacks must not keep
        // pushing the schedule into the future; a later real attempt first transitions through Leased.
        if (delivery.Status == MessageDeliveryStatus.Failed && retryable)
            return delivery;

        var now = clock.GetUtcNow().UtcDateTime;
        delivery.Status = retryable ? MessageDeliveryStatus.Failed : MessageDeliveryStatus.DeadLettered;
        delivery.FailedAtUtc ??= now;
        delivery.ErrorCode = SanitizeCode(errorCode);
        delivery.ErrorDetail = SanitizeDetail(detail);
        delivery.NextAttemptAtUtc = retryable ? now.Add(retryDelay!.Value) : null;
        ClearLease(delivery);
        delivery.UpdatedAtUtc = now;
        await context.SaveChangesAsync(ct);
        return delivery;
    }

    public async Task<MessageDelivery> ManualRetryAsync(long deliveryId, CancellationToken ct = default)
    {
        var delivery = await FindAsync(deliveryId, ct);
        if (delivery.Status is MessageDeliveryStatus.Delivered or MessageDeliveryStatus.Suppressed)
            throw new InvalidOperationException($"A {delivery.Status} delivery cannot be retried.");
        if (delivery.Status is not (MessageDeliveryStatus.Failed or MessageDeliveryStatus.DeadLettered))
            throw new InvalidOperationException($"A {delivery.Status} delivery is not eligible for manual retry.");
        if (delivery.Channel == MessageDeliveryChannel.InApp)
            throw new InvalidOperationException("In-app deliveries are not externally retried.");

        delivery.Status = MessageDeliveryStatus.Pending;
        delivery.NextAttemptAtUtc = clock.GetUtcNow().UtcDateTime;
        ClearLease(delivery);
        // Failure/submission/provider timestamps and diagnostics are historical audit fields and stay intact.
        delivery.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await context.SaveChangesAsync(ct);
        return delivery;
    }

    public async Task<bool> RecordProviderStatusAsync(string provider, string providerMessageId, string status,
        string? errorCode = null, string? errorDetail = null, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(provider);
        ArgumentException.ThrowIfNullOrWhiteSpace(providerMessageId);
        ArgumentException.ThrowIfNullOrWhiteSpace(status);
        var normalizedProvider = provider.Trim();
        var normalizedId = providerMessageId.Trim();
        var delivery = await context.MessageDeliveries.SingleOrDefaultAsync(x =>
            x.Provider == normalizedProvider && x.ProviderMessageId == normalizedId, ct);
        if (delivery is null) return false;

        switch (status.Trim().ToLowerInvariant())
        {
            case "delivered":
            case "succeeded":
                await RecordDeliveredAsync(delivery.Id, normalizedProvider, normalizedId, ct);
                break;
            case "accepted":
            case "queued":
            case "sending":
            case "sent":
            case "submitted":
                await RecordSubmittedAsync(delivery.Id, null, normalizedProvider, normalizedId, ct);
                break;
            case "failed":
            case "undelivered":
            case "bounced":
            case "rejected":
                await RecordFailedAsync(delivery.Id, errorCode ?? status, errorDetail, false, null, ct);
                break;
            default:
                return false;
        }
        return true;
    }

    public async Task<IReadOnlyList<MessageDeliveryView>> ReadForConversationAsync(
        long conversationId, long actorUserId, CancellationToken ct = default)
    {
        var conversation = await context.Conversations.WhereActiveParticipant(context.OrganizationMembers, context.Tenants, actorUserId)
            .Where(x => x.Id == conversationId)
            .Select(x => new { x.Id, x.OrganizationId })
            .SingleOrDefaultAsync(ct);
        if (conversation is null || !conversation.OrganizationId.HasValue)
            throw new KeyNotFoundException("Conversation was not found.");

        var isStaff = conversation.OrganizationId.HasValue && await context.OrganizationMembers.AnyAsync(x =>
            x.OrganizationId == conversation.OrganizationId && x.UserId == actorUserId && x.IsActive, ct);
        var rows = await context.MessageDeliveries.AsNoTracking()
            .Where(x => x.ConversationTimelineEntry.ConversationId == conversationId &&
                (isStaff || x.ConversationTimelineEntry.Visibility != TimelineVisibility.StaffOnly))
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        return rows.Select(x => new MessageDeliveryView(
            x.Id, x.Channel, x.Status, x.RecipientUserId, x.CreatedAtUtc,
            x.SubmittedAtUtc, x.DeliveredAtUtc, x.FailedAtUtc,
            isStaff ? x.MaskedDestination : null,
            isStaff ? x.Provider : null,
            isStaff ? x.ProviderMessageId : null,
            isStaff ? x.AttemptCount : null,
            isStaff ? x.NextAttemptAtUtc : null,
            isStaff ? x.ErrorCode : null,
            isStaff ? x.ErrorDetail : null)).ToArray();
    }

    private MessageDelivery CreateDelivery(long organizationId, long timelineEntryId, long? messageId,
        DeliveryTarget target, string key, DateTime now)
    {
        var normalizedDestination = NormalizeDestination(target);
        var delivered = target.Channel == MessageDeliveryChannel.InApp;
        return new MessageDelivery
        {
            OrganizationId = organizationId,
            ConversationTimelineEntryId = timelineEntryId,
            MessageId = messageId,
            Channel = target.Channel,
            Status = delivered ? MessageDeliveryStatus.Delivered : MessageDeliveryStatus.Pending,
            RecipientUserId = target.RecipientUserId,
            ProtectedDestination = normalizedDestination is null ? null : destinationProtector.Protect(normalizedDestination),
            MaskedDestination = normalizedDestination is null ? null : Mask(target.Channel, normalizedDestination),
            BodySnapshot = target.Body,
            HtmlBodySnapshot = target.HtmlBody,
            SubjectSnapshot = target.Subject,
            ProtectedFromAddress = string.IsNullOrWhiteSpace(target.FromAddress)
                ? null : destinationProtector.Protect(target.FromAddress.Trim()),
            NextAttemptAtUtc = delivered ? null : now,
            DeliveredAtUtc = delivered ? now : null,
            IdempotencyKey = key,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
    }

    private static string? NormalizeDestination(DeliveryTarget target)
    {
        if (target.Channel == MessageDeliveryChannel.InApp)
        {
            if (!target.RecipientUserId.HasValue) throw new ArgumentException("In-app delivery requires a recipient user.");
            return null;
        }
        if (string.IsNullOrWhiteSpace(target.Destination))
            throw new ArgumentException($"{target.Channel} delivery requires a destination.");
        var value = target.Destination.Trim();
        return target.Channel == MessageDeliveryChannel.Email ? value.ToLowerInvariant() : value;
    }

    private static string Mask(MessageDeliveryChannel channel, string destination)
    {
        if (channel == MessageDeliveryChannel.Email)
        {
            var at = destination.IndexOf('@');
            return at > 0 ? destination[0] + "***" + destination[at..] : "***";
        }
        var visible = destination.Length <= 4 ? destination : destination[^4..];
        return "*******" + visible;
    }

    private static string BuildKey(string operationDigest, string payloadIdentityHash)
    {
        return $"{operationDigest}:{payloadIdentityHash}";
    }

    private static string BuildPayloadIdentityHash(long organizationId, long conversationId, long timelineEntryId,
        long? messageId, DeliveryTarget target) => Hash(string.Join('|',
        organizationId, conversationId, timelineEntryId, messageId?.ToString() ?? "none", target.Channel,
        target.RecipientUserId?.ToString() ?? "none", target.Body, target.Subject ?? "none",
        target.HtmlBody ?? "none", target.FromAddress ?? "none"));

    private bool TryMatchExisting(
        IReadOnlyCollection<MessageDelivery> existing,
        IReadOnlyCollection<(DeliveryTarget Target, string? Destination)> requested,
        long timelineEntryId,
        long? messageId,
        out IReadOnlyList<MessageDelivery> matched)
    {
        var result = new List<MessageDelivery>(requested.Count);
        if (existing.Count != requested.Count ||
            existing.Any(x => x.ConversationTimelineEntryId != timelineEntryId || x.MessageId != messageId))
        {
            matched = [];
            return false;
        }

        foreach (var request in requested)
        {
            var row = existing.SingleOrDefault(x =>
                x.Channel == request.Target.Channel && x.RecipientUserId == request.Target.RecipientUserId);
            if (row is null || !DestinationMatches(row.ProtectedDestination, request.Destination) ||
                row.BodySnapshot != request.Target.Body || row.SubjectSnapshot != request.Target.Subject ||
                row.HtmlBodySnapshot != request.Target.HtmlBody ||
                !DestinationMatches(row.ProtectedFromAddress, request.Target.FromAddress?.Trim()))
            {
                matched = [];
                return false;
            }
            result.Add(row);
        }

        matched = result;
        return true;
    }

    private bool DestinationMatches(string? protectedDestination, string? requestedDestination)
    {
        if (protectedDestination is null || requestedDestination is null)
            return protectedDestination is null && requestedDestination is null;

        try
        {
            var existingDestination = destinationProtector.Unprotect(protectedDestination);
            var existingDigest = SHA256.HashData(Encoding.UTF8.GetBytes(existingDestination));
            var requestedDigest = SHA256.HashData(Encoding.UTF8.GetBytes(requestedDestination));
            return CryptographicOperations.FixedTimeEquals(existingDigest, requestedDigest);
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private async Task<MessageDelivery> FindAsync(long id, CancellationToken ct) =>
        await context.MessageDeliveries.SingleOrDefaultAsync(x => x.Id == id, ct)
        ?? throw new KeyNotFoundException("Message delivery was not found.");

    private static void EnsureProviderIdentity(MessageDelivery delivery, string provider, string providerMessageId)
    {
        if (delivery.Provider is not null && !string.Equals(delivery.Provider, provider.Trim(), StringComparison.OrdinalIgnoreCase) ||
            delivery.ProviderMessageId is not null && !string.Equals(delivery.ProviderMessageId, providerMessageId.Trim(), StringComparison.Ordinal))
            throw new InvalidOperationException("Provider identity cannot be rewritten.");
    }

    private static void ClearLease(MessageDelivery delivery)
    {
        delivery.ProcessingLeaseId = null;
        delivery.ProcessingLeaseUntilUtc = null;
    }

    private static string SanitizeCode(string value)
    {
        var sanitized = Regex.Replace(value.Trim(), "[^A-Za-z0-9_.:-]", "_");
        return sanitized[..Math.Min(100, sanitized.Length)];
    }

    private static string? SanitizeDetail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var sanitized = Regex.Replace(value, @"[\r\n\t\0-\x1f\x7f]+", " ");
        sanitized = Regex.Replace(sanitized, @"(?<!\w)[+]?\d[\d\s().-]{6,}\d", "[redacted-phone]");
        sanitized = Regex.Replace(sanitized, @"\b[^\s@]+@[^\s@]+\.[^\s@]+\b", "[redacted-email]");
        sanitized = sanitized.Trim();
        return sanitized[..Math.Min(500, sanitized.Length)];
    }
}
