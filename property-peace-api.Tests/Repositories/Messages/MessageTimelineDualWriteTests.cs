using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text.Json;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Messages;

public sealed class MessageTimelineDualWriteTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task AddMessage_CreatesExactlyOneLinkedTimelineEntry_WithSingleSaveChanges()
    {
        await SeedConversationAsync();
        var allocator = new RecordingAllocator();
        var repository = new MessageRepository(
            _context,
            new Mock<ILogger<MessageRepository>>().Object,
            MapperFactory.Create(),
            allocator);

        var result = await repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "hello timeline",
            ClientRequestId = "request-1"
        }, 1);

        var message = _context.Messages.Single();
        var timeline = _context.ConversationTimelineEntries.Single();
        timeline.MessageId.Should().Be(message.Id).And.Be(result.Id);
        timeline.Kind.Should().Be(TimelineEntryKind.Message);
        timeline.Sequence.Should().Be(1);
        timeline.Producer.Should().Be("message-api");
        timeline.EventId.Should().Be("request-1");
        allocator.Allocations.Should().Be(1);
    }

    [Fact]
    public async Task AddMessage_ClientRequestIdIsIdempotent_AndChangedPayloadConflicts()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        var request = new AddMessageDto { ConversationId = 10, Content = "same", ClientRequestId = "request-1" };

        var first = await repository.AddMessage(request, 1);
        var duplicate = await repository.AddMessage(request, 1);
        var changed = () => repository.AddMessage(
            new AddMessageDto { ConversationId = 10, Content = "changed", ClientRequestId = "request-1" }, 1);

        duplicate.Id.Should().Be(first.Id);
        duplicate.WasReplayed.Should().BeTrue();
        _context.Messages.Should().ContainSingle();
        _context.ConversationTimelineEntries.Should().ContainSingle();
        await changed.Should().ThrowAsync<TimelineIdempotencyConflictException>();
    }

    [Theory]
    [InlineData(null, TimelineEntryKind.Message, "inApp", "delivered")]
    [InlineData("sms", TimelineEntryKind.InboundSms, "sms", "received")]
    [InlineData("email", TimelineEntryKind.Email, "email", "received")]
    public async Task AddMessage_RecordsTruthfulTimelineChannelAndState(
        string? channel,
        TimelineEntryKind expectedKind,
        string expectedChannel,
        string expectedStatus)
    {
        await SeedConversationAsync();
        var repository = CreateRepository();

        await repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "channel evidence",
            ClientRequestId = $"request-{expectedChannel}",
            Channel = channel
        }, 1);

        var timeline = _context.ConversationTimelineEntries.Single();
        using var metadata = JsonDocument.Parse(timeline.MetadataJson);
        timeline.Kind.Should().Be(expectedKind);
        metadata.RootElement.GetProperty("channel").GetString().Should().Be(expectedChannel);
        metadata.RootElement.GetProperty("status").GetString().Should().Be(expectedStatus);
        metadata.RootElement.GetProperty("direction").GetString().Should()
            .Be(expectedChannel == "inApp" ? "outbound" : "inbound");
    }

    [Fact]
    public async Task AddMessage_AtomicallyRecordsDeliveredInAppEvidenceForEachActiveRecipient()
    {
        await SeedConversationAsync();
        _context.Users.AddRange(
            new User { Id = 2, SettingId = 2, Email = "active@example.com" },
            new User { Id = 3, SettingId = 3, Email = "deleted@example.com" });
        _context.ConversationParticipants.AddRange(
            new ConversationParticipant { ConversationId = 10, UserId = 2 },
            new ConversationParticipant { ConversationId = 10, UserId = 3, IsDeleted = true });
        await _context.SaveChangesAsync();

        await CreateRepository().AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "available now",
            ClientRequestId = "recipient-evidence"
        }, 1);

        var message = _context.Messages.Single();
        var timeline = _context.ConversationTimelineEntries.Single();
        var delivery = _context.MessageDeliveries.Should().ContainSingle().Subject;
        delivery.RecipientUserId.Should().Be(2);
        delivery.Channel.Should().Be(MessageDeliveryChannel.InApp);
        delivery.Status.Should().Be(MessageDeliveryStatus.Delivered);
        delivery.DeliveredAtUtc.Should().NotBeNull();
        delivery.MessageId.Should().Be(message.Id);
        delivery.ConversationTimelineEntryId.Should().Be(timeline.Id);
    }

    [Fact]
    public async Task AddMessage_AtomicallyCreatesCompleteExternalOutbox_AndReplayDoesNotDuplicateIt()
    {
        await SeedConversationAsync();
        _context.Tenants.Add(new Tenant
        {
            Id = 20, Firstname = "External", Lastname = "Tenant",
            Email = "tenant@example.test", PhoneNumber = "+14155550123"
        });
        _context.OrganizationSmsNumbers.Add(new OrganizationSmsNumber
        {
            Id = 30, OrganizationId = 100, PhoneNumber = "+14155550999", TwilioPhoneNumberSid = "PN1"
        });
        _context.Conversations.Single(x => x.Id == 10).TenantId = 20;
        await _context.SaveChangesAsync();
        var repository = new MessageRepository(_context, Mock.Of<ILogger<MessageRepository>>(), MapperFactory.Create(),
            new ConversationTimelineSequenceAllocator(), new Protector());
        var request = new AddMessageDto
        {
            ConversationId = 10, Content = "non-blank immutable body", ClientRequestId = "atomic-external"
        };

        var saved = await repository.AddMessage(request, 1);
        var replay = await repository.AddMessage(request, 1);

        replay.Id.Should().Be(saved.Id);
        var rows = _context.MessageDeliveries.OrderBy(x => x.Channel).ToList();
        rows.Should().HaveCount(2);
        rows.Should().OnlyContain(x => x.Status == MessageDeliveryStatus.Pending &&
            x.MessageId == saved.Id && x.ConversationTimelineEntryId > 0 &&
            !string.IsNullOrWhiteSpace(x.BodySnapshot) && !string.IsNullOrWhiteSpace(x.ProtectedDestination));
        rows.Single(x => x.Channel == MessageDeliveryChannel.Email).SubjectSnapshot.Should().NotBeNullOrWhiteSpace();
        rows.Single(x => x.Channel == MessageDeliveryChannel.Sms).ProtectedFromAddress.Should().Be("p:+14155550999");
    }

    [Fact]
    public async Task AddMessage_ReusedRequestIdWithDifferentChannelConflicts()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        await repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10, Content = "same", ClientRequestId = "channel-replay", Channel = "sms"
        }, 1);

        var changed = () => repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10, Content = "same", ClientRequestId = "channel-replay", Channel = "email"
        }, 1);

        await changed.Should().ThrowAsync<TimelineIdempotencyConflictException>();
        _context.Messages.Should().ContainSingle();
    }

    [Fact]
    public async Task AddMessage_ReusedProviderEventWithChangedWebhookPayloadConflicts()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        await repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10, Content = "same rendered body", ClientRequestId = "email:event-1",
            Channel = "email", TrustedProviderPayloadHash = "hash-one"
        }, 1);

        var changed = () => repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10, Content = "same rendered body", ClientRequestId = "email:event-1",
            Channel = "email", TrustedProviderPayloadHash = "hash-two"
        }, 1);

        await changed.Should().ThrowAsync<TimelineIdempotencyConflictException>();
    }

    [Fact]
    public async Task AddMessage_WhenTimelineAllocationFails_CreatesNeitherMessageNorTimeline()
    {
        await SeedConversationAsync();
        var repository = new MessageRepository(
            _context,
            new Mock<ILogger<MessageRepository>>().Object,
            MapperFactory.Create(),
            new ThrowingAllocator());

        var act = () => repository.AddMessage(new AddMessageDto { ConversationId = 10, Content = "must rollback" }, 1);

        await act.Should().ThrowAsync<InvalidOperationException>();
        _context.ChangeTracker.Clear();
        _context.Messages.Should().BeEmpty();
        _context.ConversationTimelineEntries.Should().BeEmpty();
    }

    [Fact]
    public async Task AddMessage_WhenConversationOrganizationIsUnresolved_FailsClosedWithoutOrganizationZeroEvidence()
    {
        _context.Users.Add(new User { Id = 1, SettingId = 1, Email = "sender@example.com" });
        _context.Conversations.Add(new Conversation { Id = 10, Title = "Legacy", LandlordId = 1, OrganizationId = null });
        _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        var act = () => repository.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "must not become organization zero"
        }, 1);

        await act.Should().ThrowAsync<Exception>();
        _context.ChangeTracker.Clear();
        _context.Messages.Should().BeEmpty();
        _context.ConversationTimelineEntries.Should().BeEmpty();
    }

    private MessageRepository CreateRepository() => new(
        _context,
        new Mock<ILogger<MessageRepository>>().Object,
        MapperFactory.Create(),
        new ConversationTimelineSequenceAllocator());

    private async Task SeedConversationAsync()
    {
        _context.Users.Add(new User { Id = 1, SettingId = 1, FirstName = "Sender", Email = "sender@example.com" });
        _context.Organizations.Add(new Organization { Id = 100, Name = "Messages" });
        _context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1, OrganizationId = 100, UserId = 1, IsActive = true, Role = "Manager"
        });
        _context.Conversations.Add(new Conversation { Id = 10, Title = "Messages", LandlordId = 1, OrganizationId = 100 });
        _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
        await _context.SaveChangesAsync();
    }

    private sealed class RecordingAllocator : IConversationTimelineSequenceAllocator
    {
        public int Allocations { get; private set; }

        public Task<long> AllocateAsync(DataContext context, long conversationId, CancellationToken cancellationToken = default)
        {
            Allocations++;
            context.ConversationTimelineSequences.Add(new ConversationTimelineSequence
            {
                ConversationId = conversationId,
                NextSequence = 2
            });
            return Task.FromResult(1L);
        }
    }

    private sealed class ThrowingAllocator : IConversationTimelineSequenceAllocator
    {
        public Task<long> AllocateAsync(DataContext context, long conversationId, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("allocation failed");
    }

    private sealed class Protector : ICommunicationDestinationProtector
    {
        public string Protect(string destination) => "p:" + destination;
        public string Unprotect(string protectedDestination) => protectedDestination[2..];
    }
}
