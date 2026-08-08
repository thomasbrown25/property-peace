using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Timelines;

public sealed class Milestone7PublicApiTests : IDisposable
{
    private readonly DataContext _db = DbContextFactory.Create();
    private readonly ConversationTimelineRepository _timeline;
    private readonly Milestone7ConversationService _service;

    public Milestone7PublicApiTests()
    {
        _timeline = new ConversationTimelineRepository(_db, NullLogger<ConversationTimelineRepository>.Instance,
            new ConversationTimelineSequenceAllocator());
        _service = new Milestone7ConversationService(_db, _timeline, TimeProvider.System);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Timeline_IsDtoOnly_Ordered_CursorBounded_AndOmitsSensitiveDeliveryEvidence()
    {
        await SeedAsync();
        var first = await AppendAsync("one", TimelineVisibility.Participants, TimelineEntryKind.OutboundSms,
            new Dictionary<string, string> { ["channel"] = "sms", ["status"] = "saved" }, "lease", 900, "Lease 900");
        await AppendAsync("two", TimelineVisibility.StaffOnly);
        _db.MessageDeliveries.Add(new MessageDelivery
        {
            OrganizationId = 100, ConversationTimelineEntryId = first.Id, Channel = MessageDeliveryChannel.Sms,
            Status = MessageDeliveryStatus.Delivered, ProtectedDestination = "ciphertext", ProviderMessageId = "provider-secret-full-id",
            ProcessingLeaseId = Guid.NewGuid(), ErrorDetail = "staff diagnostic", MaskedDestination = "***1234",
            IdempotencyKey = "delivery-1", CreatedAtUtc = DateTime.UtcNow, UpdatedAtUtc = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var page = await _service.ReadTimelineAsync(10, 1, null, 1);
        var json = JsonSerializer.Serialize(page);

        page.Items.Should().ContainSingle();
        page.Items[0].Context.Should().BeEquivalentTo(new TimelineContextDto("lease", 900, "Lease 900"));
        page.Items[0].Metadata.Should().ContainKey("channel");
        page.Items[0].Deliveries.Should().ContainSingle(x => x.Status == "delivered" && x.MaskedDestination == "***1234");
        page.NextCursor.Should().BeNull("there is no older participant-visible history");
        json.Should().NotContain("ciphertext").And.NotContain("provider-secret").And.NotContain("ProcessingLease").And.NotContain("diagnostic");
        await FluentActions.Invoking(() => _service.ReadTimelineAsync(10, 1, null, 101)).Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task TimelineAndSearch_ReturnNotFoundForGuessedConversation_AndHideStaffOnly()
    {
        await SeedAsync();
        await AppendAsync("public", TimelineVisibility.Participants, summary: "broken heater");
        await AppendAsync("private", TimelineVisibility.StaffOnly, summary: "staff diagnosis");

        await FluentActions.Invoking(() => _service.ReadTimelineAsync(10, 3, null, 20)).Should().ThrowAsync<KeyNotFoundException>();
        await FluentActions.Invoking(() => _service.SearchAsync(3, new TimelineSearchRequest { ConversationId = 10, Query = "heater" }))
            .Should().ThrowAsync<KeyNotFoundException>();
        var tenant = await _service.SearchAsync(1, new TimelineSearchRequest { ConversationId = 10, Query = "staff" });
        tenant.Items.Should().BeEmpty();
        var staff = await _service.SearchAsync(2, new TimelineSearchRequest { OrganizationId = 100, Query = "staff" });
        staff.Items.Should().ContainSingle(x => x.Summary == "staff diagnosis");
    }

    [Fact]
    public async Task Search_AppliesAuthorizedFiltersBeforeMatching_AndBoundsPaging()
    {
        await SeedAsync();
        await AppendAsync("sms", TimelineVisibility.Participants, TimelineEntryKind.InboundSms,
            new Dictionary<string, string> { ["channel"] = "sms", ["status"] = "received" }, summary: "water leak");
        await AppendAsync("email", TimelineVisibility.Participants, TimelineEntryKind.Email,
            new Dictionary<string, string> { ["channel"] = "email", ["status"] = "sent" }, summary: "water update");

        var result = await _service.SearchAsync(1, new TimelineSearchRequest
        {
            Query = "water", ConversationId = 10, Channel = "sms", Status = "received", Kinds = [TimelineEntryKind.InboundSms], Take = 10
        });
        result.Items.Should().ContainSingle(x => x.Kind == "inboundSms");
        await FluentActions.Invoking(() => _service.SearchAsync(1, new TimelineSearchRequest { Query = "x", Take = 101 }))
            .Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task Append_RejectsEventContextOutsideConversationOrganization()
    {
        await SeedAsync();
        _db.Properties.Add(new Property { Id = 77, OrganizationId = 200, LandlordId = 4, Name = "Other org" });
        await _db.SaveChangesAsync();

        await FluentActions.Invoking(() => AppendAsync("cross-context", TimelineVisibility.Participants,
            contextKind: "property", contextId: 77, contextLabel: "Other org"))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Unread_UsesSequenceWatermark_IsMonotonic_AndNeverRevealsGuessedConversation()
    {
        await SeedAsync();
        await AppendAsync("a", TimelineVisibility.Participants);
        await AppendAsync("b", TimelineVisibility.Participants);
        (await _service.GetUnreadAsync(10, 1)).UnreadCount.Should().Be(2);
        await _service.MarkReadAsync(10, 1, 1);
        (await _service.GetUnreadAsync(10, 1)).UnreadCount.Should().Be(1);
        await _service.MarkReadAsync(10, 1, 0);
        (await _service.GetUnreadAsync(10, 1)).LastReadSequence.Should().Be(1);
        await FluentActions.Invoking(() => _service.MarkReadAsync(10, 3, null)).Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Unread_ExcludesEntriesCreatedByTheReader_ButIncludesAllOtherVisibleTimelineKinds()
    {
        await SeedAsync();
        await AppendAsync("sms", TimelineVisibility.Participants, TimelineEntryKind.InboundSms);
        await _timeline.AppendAsync(new AppendTimelineEntryRequest
        {
            OrganizationId = 100, ConversationId = 10, Kind = TimelineEntryKind.Email,
            OccurredAtUtc = DateTime.UtcNow, ActorUserId = 1, SourceType = "test", SourceId = "own-email",
            Summary = "own", Metadata = new Dictionary<string, string> { ["status"] = "sent" },
            Visibility = TimelineVisibility.Participants, Producer = "m7-tests", EventId = "own-email",
            PayloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("own-email"))).ToLowerInvariant()
        });
        await AppendAsync("reminder", TimelineVisibility.Participants, TimelineEntryKind.Reminder);

        var unread = await _service.GetUnreadAsync(10, 1);

        unread.LatestVisibleSequence.Should().Be(3);
        unread.UnreadCount.Should().Be(2);
    }

    [Fact]
    public async Task QuickReplies_AreScoped_AuthorizedCrud_AndNeverSend()
    {
        await SeedAsync();
        var created = await _service.CreateQuickReplyAsync(2, new SaveQuickReplyRequest(100, null, "Late rent", "Please contact us.", 2, true, "lease"));
        (await _service.ListQuickRepliesAsync(2, 100, "lease")).Should().ContainSingle(x => x.Id == created.Id);
        await FluentActions.Invoking(() => _service.UpdateQuickReplyAsync(3, created.Id,
            new SaveQuickReplyRequest(100, null, "stolen", "body", 0, true, null))).Should().ThrowAsync<KeyNotFoundException>();
        _db.Messages.Should().BeEmpty();
        await _service.DeleteQuickReplyAsync(2, created.Id);
        (await _service.ListQuickRepliesAsync(2, 100, null)).Should().BeEmpty();
    }

    [Fact]
    public async Task NonStaffQuickReplyUpdate_CannotPublishOrTransferOwnership_WhileStaffCanExplicitlyDoEither()
    {
        await SeedAsync();
        var personal = await _service.CreateQuickReplyAsync(1,
            new SaveQuickReplyRequest(100, 1, "Mine", "Body", 0, true, null));

        await FluentActions.Invoking(() => _service.UpdateQuickReplyAsync(1, personal.Id,
            new SaveQuickReplyRequest(100, null, "Published", "Body", 0, true, null)))
            .Should().ThrowAsync<KeyNotFoundException>();
        await FluentActions.Invoking(() => _service.UpdateQuickReplyAsync(1, personal.Id,
            new SaveQuickReplyRequest(100, 5, "Transferred", "Body", 0, true, null)))
            .Should().ThrowAsync<KeyNotFoundException>();

        var shared = await _service.UpdateQuickReplyAsync(2, personal.Id,
            new SaveQuickReplyRequest(100, null, "Shared", "Body", 0, true, null));
        shared.OwnerUserId.Should().BeNull();
        var assigned = await _service.UpdateQuickReplyAsync(2, personal.Id,
            new SaveQuickReplyRequest(100, 5, "Assigned", "Body", 0, true, null));
        assigned.OwnerUserId.Should().Be(5);
    }

    [Fact]
    public async Task ParticipantDiscovery_IsStaffOnly()
    {
        await SeedAsync();

        await FluentActions.Invoking(() => _service.DiscoverParticipantsAsync(1, 100))
            .Should().ThrowAsync<KeyNotFoundException>();
        (await _service.DiscoverParticipantsAsync(2, 100)).Should().Contain(x => x.UserId == 1);
    }

    [Fact]
    public async Task GroupLifecycle_RejectsCrossOrg_AppendsAudit_AndDoesNotExposeHistoricalStaffEvents()
    {
        await SeedAsync();
        await AppendAsync("historical-staff", TimelineVisibility.StaffOnly);
        var group = await _service.CreateGroupAsync(2, new CreateGroupRequest(100, "Team", [1]));
        await FluentActions.Invoking(() => _service.AddGroupParticipantAsync(2, group.Id, 4)).Should().ThrowAsync<KeyNotFoundException>();
        await _service.AddGroupParticipantAsync(2, group.Id, 5);
        var newcomerTimeline = await _service.ReadTimelineAsync(group.Id, 5, null, 100);
        newcomerTimeline.Items.Should().NotContain(x => x.Visibility == "staffOnly" && x.Summary.Contains("historical"));
        await _service.RemoveGroupParticipantAsync(2, group.Id, 1);
        (await _service.ReadTimelineAsync(group.Id, 2, null, 100)).Items.Should().Contain(x => x.Kind == "system");
        await _service.LeaveGroupAsync(5, group.Id);
        await FluentActions.Invoking(() => _service.ReadTimelineAsync(group.Id, 5, null, 10)).Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task FollowUps_AreStaffOnly_Scoped_Idempotent_Concurrent_AndAudited()
    {
        await SeedAsync();
        var entry = await AppendAsync("task-source", TimelineVisibility.Participants, contextKind: "lease", contextId: 900, contextLabel: "Lease 900");
        var request = new SaveFollowUpTaskRequest(100, 10, entry.Id, "lease", 900, 2, "Call tenant", DateTime.UtcNow.AddDays(1), "task-key");
        var task = await _service.CreateFollowUpAsync(2, request);
        var replay = await _service.CreateFollowUpAsync(2, request);
        replay.Id.Should().Be(task.Id);
        await FluentActions.Invoking(() => _service.ListFollowUpsAsync(1, 100, 10)).Should().ThrowAsync<KeyNotFoundException>();
        await FluentActions.Invoking(() => _service.GetFollowUpAsync(2, task.Id + 999)).Should().ThrowAsync<KeyNotFoundException>();
        var completed = await _service.CompleteFollowUpAsync(2, task.Id, task.RowVersion);
        completed.Status.Should().Be("completed");
        completed.CompletedAtUtc.Should().NotBeNull();
        (await _service.ReadTimelineAsync(10, 2, null, 100)).Items.Should().Contain(x => x.Summary.Contains("Call tenant"));
        await FluentActions.Invoking(() => _service.CompleteFollowUpAsync(2, task.Id, task.RowVersion))
            .Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    private async Task<ConversationTimelineEntry> AppendAsync(string eventId, TimelineVisibility visibility,
        TimelineEntryKind kind = TimelineEntryKind.System, IReadOnlyDictionary<string, string>? metadata = null,
        string? contextKind = null, long? contextId = null, string? contextLabel = null, string summary = "summary") =>
        await _timeline.AppendAsync(new AppendTimelineEntryRequest
        {
            OrganizationId = 100, ConversationId = 10, Kind = kind, OccurredAtUtc = DateTime.UtcNow,
            ActorUserId = 2, SourceType = "test", SourceId = eventId, Summary = summary,
            MetadataVersion = 1, Metadata = metadata ?? new Dictionary<string, string> { ["status"] = "created" },
            ContextKind = contextKind, ContextId = contextId, ContextLabel = contextLabel,
            Visibility = visibility, Producer = "m7-tests", EventId = eventId,
            PayloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(eventId))).ToLowerInvariant()
        });

    private async Task SeedAsync()
    {
        _db.Users.AddRange(
            new User { Id = 1, SettingId = 1, Email = "tenant@one.test" },
            new User { Id = 2, SettingId = 2, Email = "staff@one.test" },
            new User { Id = 3, SettingId = 3, Email = "outsider.test" },
            new User { Id = 4, SettingId = 4, Email = "other-org.test" },
            new User { Id = 5, SettingId = 5, Email = "newstaff@one.test" });
        _db.Tenants.Add(new Tenant
        {
            Id = 500, UserId = 1, OrganizationId = 100,
            Firstname = "Tenant", Lastname = "One", Email = "tenant@one.test"
        });
        _db.Conversations.Add(new Conversation
        {
            Id = 10, OrganizationId = 100, LandlordId = 2, TenantId = 500, Title = "Lease chat"
        });
        _db.Properties.Add(new Property { Id = 600, OrganizationId = 100, LandlordId = 2, Name = "Timeline property" });
        _db.Units.Add(new Unit { Id = 700, OrganizationId = 100, PropertyId = 600, Name = "Unit 700" });
        _db.Leases.Add(new Lease { Id = 900, OrganizationId = 100, UnitId = 700 });
        _db.ConversationParticipants.AddRange(
            new ConversationParticipant { ConversationId = 10, UserId = 1 },
            new ConversationParticipant { ConversationId = 10, UserId = 2, IsAdmin = true });
        _db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 100, UserId = 2, IsActive = true, Role = "Manager" },
            new OrganizationMember { Id = 2, OrganizationId = 200, UserId = 4, IsActive = true, Role = "Manager" },
            new OrganizationMember { Id = 3, OrganizationId = 100, UserId = 5, IsActive = true, Role = "Viewer" });
        await _db.SaveChangesAsync();
    }
}
