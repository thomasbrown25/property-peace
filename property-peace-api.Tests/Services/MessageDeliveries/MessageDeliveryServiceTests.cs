using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Services.MessageDeliveries;

public sealed class MessageDeliveryServiceTests : IDisposable
{
    private readonly DataContext context = DbContextFactory.Create();
    private readonly MutableTimeProvider clock = new(new DateTimeOffset(2026, 8, 8, 12, 0, 0, TimeSpan.Zero));

    public void Dispose() => context.Dispose();

    [Fact]
    public void Model_HasDurableOwnershipConcurrencyAndUniquenessConstraints()
    {
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(MessageDelivery))!;

        entity.FindProperty(nameof(MessageDelivery.OrganizationId)).Should().NotBeNull();
        entity.FindProperty(nameof(MessageDelivery.ConversationTimelineEntryId)).Should().NotBeNull();
        entity.FindProperty(nameof(MessageDelivery.RowVersion))!.IsConcurrencyToken.Should().BeTrue();
        entity.GetIndexes().Should().Contain(i => i.IsUnique &&
            i.Properties.Select(p => p.Name).SequenceEqual(new[] { "OrganizationId", "IdempotencyKey" }));
        entity.GetIndexes().Should().Contain(i => i.IsUnique && i.GetFilter() == "[ProviderMessageId] IS NOT NULL" &&
            i.Properties.Select(p => p.Name).SequenceEqual(new[] { "Provider", "ProviderMessageId" }));
        entity.FindProperty(nameof(MessageDelivery.ErrorDetail))!.GetMaxLength().Should().Be(500);
        entity.FindProperty(nameof(MessageDelivery.ProtectedDestination))!.GetMaxLength().Should().Be(2000);
    }

    [Fact]
    public async Task Create_IsAtomicIdempotentPerChannelRecipient_AndNeverPersistsRawDestination()
    {
        await SeedAsync();
        var service = CreateService();
        var requests = new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.InApp, 1, null),
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123", "immutable sms", FromAddress: "+14155550999"),
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com", "immutable plain", "immutable subject", "<p>immutable</p>")
        };

        var first = await service.CreateAsync(100, 10, 50, 40, "send-1", requests);
        var duplicate = await service.CreateAsync(100, 10, 50, 40, "send-1", requests);

        first.Should().HaveCount(3);
        duplicate.Select(x => x.Id).Should().Equal(first.Select(x => x.Id));
        context.MessageDeliveries.Should().HaveCount(3);
        first.Single(x => x.Channel == MessageDeliveryChannel.InApp).Status.Should().Be(MessageDeliveryStatus.Delivered);
        first.Where(x => x.Channel != MessageDeliveryChannel.InApp).Should().OnlyContain(x => x.Status == MessageDeliveryStatus.Pending);
        first.Single(x => x.Channel == MessageDeliveryChannel.Sms).MaskedDestination.Should().Be("*******0123");
        first.Single(x => x.Channel == MessageDeliveryChannel.Email).MaskedDestination.Should().Be("t***@example.com");
        first.Single(x => x.Channel == MessageDeliveryChannel.Sms).BodySnapshot.Should().Be("immutable sms");
        first.Single(x => x.Channel == MessageDeliveryChannel.Sms).ProtectedFromAddress.Should().NotBe("+14155550999");
        first.Single(x => x.Channel == MessageDeliveryChannel.Email).SubjectSnapshot.Should().Be("immutable subject");
        first.Single(x => x.Channel == MessageDeliveryChannel.Email).HtmlBodySnapshot.Should().Be("<p>immutable</p>");
        context.MessageDeliveries.Select(x => x.ProtectedDestination).Should().NotContain(new[] { "+14155550123", "tenant@example.com" });
    }

    [Fact]
    public async Task Create_RejectsReusedIdempotencyKeyWithChangedDestination()
    {
        await SeedAsync();
        var service = CreateService();
        await service.CreateAsync(100, 10, 50, 40, "same-operation", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123")
        });

        var changed = () => service.CreateAsync(100, 10, 50, 40, "same-operation", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550999")
        });

        await changed.Should().ThrowAsync<InvalidOperationException>().WithMessage("*different payload*");
        context.MessageDeliveries.Should().ContainSingle();
    }

    [Fact]
    public async Task Create_RejectsReusedIdempotencyKeyWithChangedCorrelation()
    {
        await SeedAsync();
        context.Messages.Add(new Message { Id = 41, ConversationId = 10, OrganizationId = 100, SenderId = 1, Content = "other" });
        context.ConversationTimelineEntries.Add(new ConversationTimelineEntry
        {
            Id = 51, OrganizationId = 100, ConversationId = 10, MessageId = 41, Sequence = 2,
            Kind = TimelineEntryKind.Message, OccurredAtUtc = clock.GetUtcNow().UtcDateTime,
            SourceType = "message", SourceId = "41", Summary = "other", Producer = "test", EventId = "message-41",
            PayloadHash = new string('b', 64)
        });
        await context.SaveChangesAsync();
        var service = CreateService();
        var target = new[] { new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com") };
        await service.CreateAsync(100, 10, 50, 40, "same-correlation", target);

        var changed = () => service.CreateAsync(100, 10, 51, 41, "same-correlation", target);

        await changed.Should().ThrowAsync<InvalidOperationException>().WithMessage("*different payload*");
        context.MessageDeliveries.Should().ContainSingle();
    }

    [Fact]
    public async Task Create_DoesNotPersistADeterministicDestinationVerifierInIdempotencyKey()
    {
        static async Task<string> CreateKeyAsync(string destination)
        {
            await using var isolatedContext = DbContextFactory.Create();
            var isolatedClock = new MutableTimeProvider(new DateTimeOffset(2026, 8, 8, 12, 0, 0, TimeSpan.Zero));
            isolatedContext.Users.Add(new User { Id = 1, SettingId = 1, Email = "tenant@example.com" });
            isolatedContext.Conversations.Add(new Conversation
                { Id = 10, Title = "Delivery", LandlordId = 1, OrganizationId = 100 });
            isolatedContext.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
            isolatedContext.Messages.Add(new Message
                { Id = 40, ConversationId = 10, OrganizationId = 100, SenderId = 1, Content = "durable" });
            isolatedContext.ConversationTimelineEntries.Add(new ConversationTimelineEntry
            {
                Id = 50, OrganizationId = 100, ConversationId = 10, MessageId = 40, Sequence = 1,
                Kind = TimelineEntryKind.Message, OccurredAtUtc = isolatedClock.GetUtcNow().UtcDateTime,
                SourceType = "message", SourceId = "40", Summary = "durable", Producer = "test",
                EventId = "message-40", PayloadHash = new string('a', 64)
            });
            await isolatedContext.SaveChangesAsync();
            var service = new MessageDeliveryService(isolatedContext, new FakeProtector(), isolatedClock);

            return (await service.CreateAsync(100, 10, 50, 40, "same-operation",
                [new DeliveryTarget(MessageDeliveryChannel.Sms, 1, destination)])).Single().IdempotencyKey;
        }

        var first = await CreateKeyAsync("+14155550123");
        var changedDestination = await CreateKeyAsync("+14155550999");

        changedDestination.Should().Be(first,
            "the protected destination, not a deterministic persisted digest, must verify a replay");
    }

    [Fact]
    public async Task Read_DoesNotExposeStaffOnlyDeliveryToOrdinaryParticipant()
    {
        await SeedAsync(includeStaff: true, staffOnlyTimeline: true);
        var service = CreateService();
        await service.CreateAsync(100, 10, 50, 40, "staff-only", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com")
        });

        (await service.ReadForConversationAsync(10, 1)).Should().BeEmpty();
        (await service.ReadForConversationAsync(10, 2)).Should().ContainSingle();
    }

    [Fact]
    public async Task Lease_ClaimsOnlyDueExternalDeliveries_AndUsesLeaseIdentity()
    {
        await SeedAsync();
        var service = CreateService();
        await service.CreateAsync(100, 10, 50, 40, "lease", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.InApp, 1, null),
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123"),
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com")
        });
        context.MessageDeliveries.Single(x => x.Channel == MessageDeliveryChannel.Email).NextAttemptAtUtc = clock.GetUtcNow().UtcDateTime.AddMinutes(1);
        await context.SaveChangesAsync();

        var leaseId = Guid.NewGuid();
        var leased = await service.LeaseDueAsync(1, leaseId, TimeSpan.FromMinutes(2));

        leased.Should().ContainSingle(x => x.Channel == MessageDeliveryChannel.Sms);
        leased[0].Status.Should().Be(MessageDeliveryStatus.Leased);
        leased[0].ProcessingLeaseId.Should().Be(leaseId);
        leased[0].AttemptCount.Should().Be(1);
        leased[0].ProcessingLeaseUntilUtc.Should().Be(clock.GetUtcNow().UtcDateTime.AddMinutes(2));
    }

    [Fact]
    public async Task SubmissionBoundary_IsPersistedBeforeProviderCall_AndExpiredRowIsNotRelesased()
    {
        await SeedAsync();
        var service = CreateService();
        var delivery = (await service.CreateAsync(100, 10, 50, 40, "at-most-once", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123", "complete body")
        })).Single();
        var leaseId = Guid.NewGuid();
        await service.LeaseDueAsync(1, leaseId, TimeSpan.FromMinutes(2));

        await service.RecordSubmissionStartedAsync(delivery.Id, leaseId);
        clock.Advance(TimeSpan.FromMinutes(3));
        var replayLease = await service.LeaseDueAsync(1, Guid.NewGuid(), TimeSpan.FromMinutes(2));

        delivery.Status.Should().Be(MessageDeliveryStatus.Submitting);
        delivery.ProviderMessageId.Should().BeNull("the system must not synthesize provider identity");
        delivery.DeliveredAtUtc.Should().BeNull("submission is not delivery evidence");
        replayLease.Should().BeEmpty("an ambiguous provider outcome must not be sent twice");
    }

    [Fact]
    public async Task Callbacks_AreIdempotentMonotonic_AndDeliveredNeverRegresses()
    {
        await SeedAsync();
        var service = CreateService();
        var delivery = (await service.CreateAsync(100, 10, 50, 40, "callbacks", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123")
        })).Single();
        var leaseId = Guid.NewGuid();
        await service.LeaseDueAsync(1, leaseId, TimeSpan.FromMinutes(2));

        await service.RecordSubmittedAsync(delivery.Id, leaseId, "twilio", "SM-1");
        await service.RecordSubmittedAsync(delivery.Id, leaseId, "twilio", "SM-1");
        clock.Advance(TimeSpan.FromMinutes(1));
        await service.RecordDeliveredAsync(delivery.Id, "twilio", "SM-1");
        var deliveredAt = delivery.DeliveredAtUtc;
        clock.Advance(TimeSpan.FromMinutes(1));
        await service.RecordFailedAsync(delivery.Id, "late_failure", "phone +14155550123 rejected\nsecret", true, TimeSpan.FromMinutes(5));
        await service.RecordSubmittedAsync(delivery.Id, null, "twilio", "SM-1");

        delivery.Status.Should().Be(MessageDeliveryStatus.Delivered);
        delivery.DeliveredAtUtc.Should().Be(deliveredAt);
        delivery.ErrorCode.Should().BeNull();
        delivery.ErrorDetail.Should().BeNull();
    }

    [Fact]
    public async Task ProviderStatusCallback_MapsSubmittedDeliveredAndTerminalFailureThroughLifecycle()
    {
        await SeedAsync();
        var service = CreateService();
        var deliveries = await service.CreateAsync(100, 10, 50, 40, "provider-callbacks", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123"),
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com")
        });
        var sms = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Sms);
        var email = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Email);
        await service.RecordSubmittedAsync(sms.Id, null, "twilio", "SM-status");
        await service.RecordSubmittedAsync(email.Id, null, "azure-email", "EM-status");

        (await service.RecordProviderStatusAsync("twilio", "SM-status", "sent")).Should().BeTrue();
        sms.Status.Should().Be(MessageDeliveryStatus.Submitted);
        clock.Advance(TimeSpan.FromMinutes(1));
        (await service.RecordProviderStatusAsync("twilio", "SM-status", "delivered")).Should().BeTrue();
        sms.Status.Should().Be(MessageDeliveryStatus.Delivered);
        sms.DeliveredAtUtc.Should().Be(clock.GetUtcNow().UtcDateTime);

        (await service.RecordProviderStatusAsync("azure-email", "EM-status", "bounced", "mailbox_full", "rejected"))
            .Should().BeTrue();
        email.Status.Should().Be(MessageDeliveryStatus.DeadLettered);
        email.ErrorCode.Should().Be("mailbox_full");
        email.ErrorDetail.Should().Be("rejected");
    }

    [Fact]
    public async Task ProviderStatusCallback_UnknownDeliveryOrStatusDoesNotChangeEvidence()
    {
        await SeedAsync();
        var service = CreateService();
        var delivery = (await service.CreateAsync(100, 10, 50, 40, "provider-unknown", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123")
        })).Single();
        await service.RecordSubmittedAsync(delivery.Id, null, "twilio", "SM-known");

        (await service.RecordProviderStatusAsync("twilio", "SM-missing", "delivered")).Should().BeFalse();
        (await service.RecordProviderStatusAsync("twilio", "SM-known", "mystery")).Should().BeFalse();
        delivery.Status.Should().Be(MessageDeliveryStatus.Submitted);
        delivery.DeliveredAtUtc.Should().BeNull();
        delivery.FailedAtUtc.Should().BeNull();
    }

    [Fact]
    public async Task Failure_SanitizesAndBoundsDetail_SchedulesRetry_OrDeadLetters()
    {
        await SeedAsync();
        var service = CreateService();
        var deliveries = await service.CreateAsync(100, 10, 50, 40, "failures", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123"),
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com")
        });

        var retry = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Sms);
        await service.RecordFailedAsync(retry.Id, "timeout", new string('x', 600) + "\r\nnext", true, TimeSpan.FromMinutes(5));
        var originalRetryAt = retry.NextAttemptAtUtc;
        var originalFailedAt = retry.FailedAtUtc;
        clock.Advance(TimeSpan.FromMinutes(1));
        await service.RecordFailedAsync(retry.Id, "timeout", new string('x', 600) + "\r\nnext", true, TimeSpan.FromMinutes(5));
        retry.Status.Should().Be(MessageDeliveryStatus.Failed);
        retry.NextAttemptAtUtc.Should().Be(originalRetryAt);
        retry.FailedAtUtc.Should().Be(originalFailedAt);
        retry.ErrorDetail.Should().HaveLength(500).And.NotContain("\n").And.NotContain("\r");

        var terminal = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Email);
        await service.RecordFailedAsync(terminal.Id, "invalid_destination", "bad address", false, null);
        terminal.Status.Should().Be(MessageDeliveryStatus.DeadLettered);
        terminal.NextAttemptAtUtc.Should().BeNull();
    }

    [Fact]
    public async Task ManualRetry_RejectsDeliveredAndSuppressed_AndPreservesAuditFields()
    {
        await SeedAsync();
        var service = CreateService();
        var deliveries = await service.CreateAsync(100, 10, 50, 40, "manual", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123"),
            new DeliveryTarget(MessageDeliveryChannel.Email, 1, "tenant@example.com"),
            new DeliveryTarget(MessageDeliveryChannel.InApp, 1, null)
        });
        var failed = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Sms);
        await service.RecordFailedAsync(failed.Id, "terminal", "kept audit", false, null);
        var failedAt = failed.FailedAtUtc;
        var suppressed = deliveries.Single(x => x.Channel == MessageDeliveryChannel.Email);
        suppressed.Status = MessageDeliveryStatus.Suppressed;
        await context.SaveChangesAsync();

        await service.ManualRetryAsync(failed.Id);
        var retryDelivered = () => service.ManualRetryAsync(deliveries.Single(x => x.Channel == MessageDeliveryChannel.InApp).Id);
        var retrySuppressed = () => service.ManualRetryAsync(suppressed.Id);

        failed.Status.Should().Be(MessageDeliveryStatus.Pending);
        failed.FailedAtUtc.Should().Be(failedAt);
        failed.ErrorCode.Should().Be("terminal");
        await retryDelivered.Should().ThrowAsync<InvalidOperationException>();
        await retrySuppressed.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Read_RequiresActiveParticipant_AndProviderDetailIsStaffOnly()
    {
        await SeedAsync(includeStaff: true);
        var service = CreateService();
        var delivery = (await service.CreateAsync(100, 10, 50, 40, "read", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123")
        })).Single();
        await service.RecordFailedAsync(delivery.Id, "provider_secret", "sensitive provider detail", false, null);

        var participant = await service.ReadForConversationAsync(10, 1);
        var staff = await service.ReadForConversationAsync(10, 2);
        var outsider = () => service.ReadForConversationAsync(10, 3);

        participant.Should().ContainSingle();
        participant[0].Provider.Should().BeNull();
        participant[0].ProviderMessageId.Should().BeNull();
        participant[0].ErrorCode.Should().BeNull();
        participant[0].ErrorDetail.Should().BeNull();
        participant[0].MaskedDestination.Should().BeNull();
        staff[0].Provider.Should().BeNull();
        staff[0].ErrorCode.Should().Be("provider_secret");
        staff[0].ErrorDetail.Should().Be("sensitive provider detail");
        staff[0].MaskedDestination.Should().Be("*******0123");
        await outsider.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task DeliveryLifecycle_CannotDeleteOrRewriteMessageTimeline_AndFailureLeavesBothSaved()
    {
        await SeedAsync();
        var service = CreateService();
        var delivery = (await service.CreateAsync(100, 10, 50, 40, "independent", new[]
        {
            new DeliveryTarget(MessageDeliveryChannel.Sms, 1, "+14155550123")
        })).Single();

        await service.RecordFailedAsync(delivery.Id, "terminal", "failed", false, null);

        (await context.Messages.FindAsync(40L)).Should().NotBeNull();
        (await context.ConversationTimelineEntries.FindAsync(50L)).Should().NotBeNull();
        context.Remove(delivery);
        var delete = () => context.SaveChangesAsync();
        await delete.Should().ThrowAsync<InvalidOperationException>().WithMessage("*delivery evidence*");
    }

    private MessageDeliveryService CreateService() => new(context, new FakeProtector(), clock);

    private async Task SeedAsync(bool includeStaff = false, bool staffOnlyTimeline = false)
    {
        context.Users.AddRange(
            new User { Id = 1, SettingId = 1, Email = "tenant@example.com" },
            new User { Id = 2, SettingId = 2, Email = "staff@example.com" },
            new User { Id = 3, SettingId = 3, Email = "outsider@example.com" });
        context.Tenants.Add(new Tenant
        {
            Id = 30, UserId = 1, OrganizationId = 100,
            Firstname = "Tenant", Lastname = "One", Email = "tenant@example.com"
        });
        context.Conversations.Add(new Conversation
        {
            Id = 10, Title = "Delivery", LandlordId = 2, OrganizationId = 100, TenantId = 30
        });
        context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
        if (includeStaff)
        {
            context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 2 });
            context.OrganizationMembers.Add(new OrganizationMember { Id = 20, OrganizationId = 100, UserId = 2, IsActive = true, Role = "Manager" });
        }
        context.Messages.Add(new Message { Id = 40, ConversationId = 10, OrganizationId = 100, SenderId = 1, Content = "durable" });
        context.ConversationTimelineEntries.Add(new ConversationTimelineEntry
        {
            Id = 50, OrganizationId = 100, ConversationId = 10, MessageId = 40, Sequence = 1,
            Kind = TimelineEntryKind.Message, OccurredAtUtc = clock.GetUtcNow().UtcDateTime,
            SourceType = "message", SourceId = "40", Summary = "durable", Producer = "test", EventId = "message-40",
            PayloadHash = new string('a', 64),
            Visibility = staffOnlyTimeline ? TimelineVisibility.StaffOnly : TimelineVisibility.Participants
        });
        await context.SaveChangesAsync();
    }

    private sealed class FakeProtector : ICommunicationDestinationProtector
    {
        public string Protect(string destination) => "protected:" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(destination));
        public string Unprotect(string protectedDestination) => System.Text.Encoding.UTF8.GetString(
            Convert.FromBase64String(protectedDestination["protected:".Length..]));
    }

    private sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset current = now;
        public override DateTimeOffset GetUtcNow() => current;
        public void Advance(TimeSpan duration) => current = current.Add(duration);
    }
}
