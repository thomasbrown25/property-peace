using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Timelines;

public sealed class ConversationTimelineRepositoryTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public void Model_UsesTypedContextLinks_AppendOnlyEntries_AndSqlSafeCounter()
    {
        var model = _context.GetService<IDesignTimeModel>().Model;
        var link = model.FindEntityType(typeof(ConversationContextLink))!;
        var entry = model.FindEntityType(typeof(ConversationTimelineEntry))!;
        var counter = model.FindEntityType(typeof(ConversationTimelineSequence))!;

        new[] { "PropertyId", "UnitId", "ListingId", "LeadId", "RentalApplicationId", "LeaseId", "PaymentId", "MaintenanceRequestId" }
            .Should().OnlyContain(name => link.FindProperty(name) != null);
        link.GetCheckConstraints().Should().ContainSingle(c => c.Name == "CK_ConversationContextLinks_ExactlyOneTarget");
        var targetIndexes = link.GetIndexes().Where(i => i.IsUnique).ToList();
        targetIndexes.Should().HaveCount(8);
        targetIndexes.Should().OnlyContain(i => i.Properties.Count == 2 &&
            i.Properties[0].Name == nameof(ConversationContextLink.ConversationId) &&
            i.GetFilter() == $"[{i.Properties[1].Name}] IS NOT NULL");
        entry.GetIndexes().Should().Contain(i => i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "ConversationId", "Sequence" }));
        entry.GetIndexes().Should().Contain(i => i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "OrganizationId", "Producer", "EventId" }));
        counter.FindProperty(nameof(ConversationTimelineSequence.RowVersion))!.IsConcurrencyToken.Should().BeTrue();
    }

    [Fact]
    public async Task Append_IsIdempotentForSameHash_AndConflictsForChangedHash()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        var request = Request(eventId: "evt-1", hash: new string('a', 64));

        var first = await repository.AppendAsync(request);
        var duplicate = await repository.AppendAsync(request);
        var changed = () => repository.AppendAsync(Request(eventId: "evt-1", hash: new string('b', 64)));

        duplicate.Id.Should().Be(first.Id);
        duplicate.Sequence.Should().Be(first.Sequence);
        _context.ConversationTimelineEntries.Should().ContainSingle();
        await changed.Should().ThrowAsync<TimelineIdempotencyConflictException>();
    }

    [Fact]
    public async Task Read_RequiresActiveParticipant_AndHidesStaffOnlyFromOrdinaryTenant()
    {
        await SeedConversationAsync(includeStaff: true);
        var repository = CreateRepository();
        await repository.AppendAsync(Request("participant", new string('a', 64), TimelineVisibility.Participants));
        await repository.AppendAsync(Request("staff", new string('b', 64), TimelineVisibility.StaffOnly));

        var tenantPage = await repository.ReadAsync(10, actorUserId: 1, afterSequence: null, take: 50);
        var staffPage = await repository.ReadAsync(10, actorUserId: 2, afterSequence: null, take: 50);
        var outsider = () => repository.ReadAsync(10, actorUserId: 3, afterSequence: null, take: 50);

        tenantPage.Items.Should().ContainSingle(e => e.Visibility == TimelineVisibility.Participants);
        staffPage.Items.Should().HaveCount(2);
        await outsider.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Read_LoadsNewestInitialPageAscending_ThenCursorLoadsOlderPagesWithoutDuplicatesOrGaps()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        for (var i = 1; i <= 5; i++)
            await repository.AppendAsync(Request($"evt-{i}", i.ToString("x").PadLeft(64, '0')));

        var first = await repository.ReadAsync(10, 1, null, 2);
        var second = await repository.ReadAsync(10, 1, first.NextCursor, 2);
        var third = await repository.ReadAsync(10, 1, second.NextCursor, 2);

        first.Items.Select(x => x.Sequence).Should().Equal(4, 5);
        first.NextCursor.Should().Be(4);
        second.Items.Select(x => x.Sequence).Should().Equal(2, 3);
        second.NextCursor.Should().Be(2);
        third.Items.Select(x => x.Sequence).Should().Equal(1);
        third.NextCursor.Should().BeNull();
        first.Items.Concat(second.Items).Concat(third.Items).Select(x => x.Sequence)
            .Should().BeEquivalentTo([1L, 2L, 3L, 4L, 5L]);
    }

    [Fact]
    public async Task Read_FailsClosedForLegacyConversationAndStaleStaff_ButAllowsCurrentTenantRelationship()
    {
        await SeedConversationAsync(includeStaff: true);
        var repository = CreateRepository();
        await repository.AppendAsync(Request("auth", new string('d', 64)));

        _context.OrganizationMembers.Single(x => x.UserId == 2).IsActive = false;
        await _context.SaveChangesAsync();

        await repository.ReadAsync(10, 1, null, 10);
        await FluentActions.Invoking(() => repository.ReadAsync(10, 2, null, 10))
            .Should().ThrowAsync<KeyNotFoundException>();

        _context.Conversations.Single(x => x.Id == 10).OrganizationId = null;
        await _context.SaveChangesAsync();
        await FluentActions.Invoking(() => repository.ReadAsync(10, 1, null, 10))
            .Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task TimelineEntries_AreRejectedWhenModifiedOrDeleted()
    {
        await SeedConversationAsync();
        var repository = CreateRepository();
        var entry = await repository.AppendAsync(Request("immutable", new string('c', 64)));

        entry.Summary = "rewritten";
        var modify = () => _context.SaveChangesAsync();
        await modify.Should().ThrowAsync<InvalidOperationException>().WithMessage("*append-only*");

        _context.Entry(entry).State = EntityState.Unchanged;
        _context.Remove(entry);
        var delete = () => _context.SaveChangesAsync();
        await delete.Should().ThrowAsync<InvalidOperationException>().WithMessage("*append-only*");
    }

    private ConversationTimelineRepository CreateRepository() => new(
        _context,
        new Mock<ILogger<ConversationTimelineRepository>>().Object,
        new ConversationTimelineSequenceAllocator());

    private static AppendTimelineEntryRequest Request(
        string eventId,
        string hash,
        TimelineVisibility visibility = TimelineVisibility.Participants) => new()
    {
        OrganizationId = 100,
        ConversationId = 10,
        Kind = TimelineEntryKind.System,
        OccurredAtUtc = DateTime.UtcNow,
        ActorUserId = 1,
        SourceType = "test",
        SourceId = "source-1",
        Summary = "summary",
        MetadataVersion = 1,
        Metadata = new Dictionary<string, string> { ["status"] = "created" },
        Visibility = visibility,
        Producer = "test-suite",
        EventId = eventId,
        PayloadHash = hash
    };

    private async Task SeedConversationAsync(bool includeStaff = false)
    {
        _context.Users.AddRange(
            new User { Id = 1, SettingId = 1, Email = "tenant@example.com" },
            new User { Id = 2, SettingId = 2, Email = "staff@example.com" },
            new User { Id = 3, SettingId = 3, Email = "outsider@example.com" });
        _context.Organizations.Add(new Organization { Id = 100, Name = "Timeline Org" });
        _context.Conversations.Add(new Conversation { Id = 10, Title = "Timeline", LandlordId = 2, OrganizationId = 100, TenantId = 10 });
        _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
        _context.Tenants.Add(new Tenant { Id = 10, UserId = 1, OrganizationId = 100, Firstname = "Test", Lastname = "Tenant" });
        if (includeStaff)
        {
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 2 });
            _context.OrganizationMembers.Add(new OrganizationMember { Id = 20, OrganizationId = 100, UserId = 2, IsActive = true, Role = "Manager" });
        }
        await _context.SaveChangesAsync();
    }
}
