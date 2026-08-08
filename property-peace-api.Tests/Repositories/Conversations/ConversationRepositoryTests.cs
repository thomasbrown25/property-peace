using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Conversations
{
    public class ConversationRepositoryTests : IDisposable
    {
        private readonly DataContext _context;
        private readonly ConversationRepository _repo;

        public ConversationRepositoryTests()
        {
            _context = DbContextFactory.Create();
            var mapper = MapperFactory.Create();
            var logger = new Mock<ILogger<ConversationRepository>>().Object;
            _repo = new ConversationRepository(_context, logger, mapper);
        }

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task AddConversation_ReusesExistingDirectTenantConversation_IgnoringLeaseAndProperty()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Tara", "Tenant", "tenant@example.com");
            SeedTenant(10, 2, "tenant@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true });
            _context.Properties.AddRange(
                new Property { Id = 200, LandlordId = 1, OrganizationId = 50 },
                new Property { Id = 201, LandlordId = 1, OrganizationId = 50 });
            _context.Units.AddRange(
                new Unit { Id = 300, PropertyId = 200, OrganizationId = 50 },
                new Unit { Id = 301, PropertyId = 201, OrganizationId = 50 });
            _context.Leases.AddRange(
                new Lease { Id = 100, UnitId = 300, OrganizationId = 50 },
                new Lease { Id = 101, UnitId = 301, OrganizationId = 50 });
            _context.TenantLeases.AddRange(
                new TenantLease { TenantId = 10, LeaseId = 100 },
                new TenantLease { TenantId = 10, LeaseId = 101 });
            await _context.SaveChangesAsync();

            var first = await _repo.AddConversation(new AddConversationDto
            {
                Title = "First lease thread",
                TenantId = 10,
                LeaseId = 100,
                PropertyId = 200,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            var second = await _repo.AddConversation(new AddConversationDto
            {
                Title = "Second lease thread",
                TenantId = 10,
                LeaseId = 101,
                PropertyId = 201,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            second.Id.Should().Be(first.Id);
            _context.Conversations.Should().ContainSingle(c => !c.IsGroupChat && c.LandlordId == 1 && c.TenantId == 10);
            _context.ConversationParticipants
                .Where(p => p.ConversationId == first.Id && !p.IsDeleted)
                .Select(p => p.UserId)
                .Should().BeEquivalentTo([1L, 2L]);
        }

        [Fact]
        public async Task AddConversation_ReusesExistingDirectConversation_WhenTenantRecordChangesButUserIsSame()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Tara", "Tenant", "tenant@example.com");
            SeedTenant(10, 2, "tenant@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true });
            await _context.SaveChangesAsync();

            var first = await _repo.AddConversation(new AddConversationDto
            {
                Title = "Original tenant row",
                TenantId = 10,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            SeedTenant(11, 2, "tenant@example.com");
            await _context.SaveChangesAsync();

            var second = await _repo.AddConversation(new AddConversationDto
            {
                Title = "New tenant row, same person",
                TenantId = 11,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            second.Id.Should().Be(first.Id);
            _context.Conversations.Count(c => !c.IsGroupChat && c.LandlordId == 1).Should().Be(1);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public async Task GetConversationById_ReturnsNull_WhenActorIsNotAnActiveParticipant(bool hasSoftDeletedParticipant)
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Other", "User", "other@example.com");
            _context.Conversations.Add(new Conversation { Id = 20, Title = "Private", LandlordId = 1 });
            _context.ConversationParticipants.Add(new ConversationParticipant
            {
                ConversationId = 20,
                UserId = 1
            });
            if (hasSoftDeletedParticipant)
            {
                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = 20,
                    UserId = 2,
                    IsDeleted = true
                });
            }
            await _context.SaveChangesAsync();

            var result = await _repo.GetConversationById(20, 2);

            result.Should().BeNull();
        }

        [Theory]
        [InlineData("update")]
        [InlineData("delete")]
        [InlineData("archive")]
        [InlineData("pin")]
        public async Task ConversationMutations_UseNotFoundSemantics_ForUnauthorizedActor(string operation)
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Other", "User", "other@example.com");
            _context.Conversations.Add(new Conversation { Id = 30, Title = "Private", LandlordId = 1, OrganizationId = 50 });
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 30, UserId = 1 });
            await _context.SaveChangesAsync();

            Func<Task> act = operation switch
            {
                "update" => async () => await _repo.UpdateConversation(30, new AddConversationDto { Title = "stolen" }, 2),
                "delete" => async () => await _repo.DeleteConversation(30, 2),
                "archive" => async () => await _repo.ArchiveConversation(30, true, 2),
                _ => async () => await _repo.PinConversation(30, true, 2)
            };

            await act.Should().ThrowAsync<KeyNotFoundException>();
            var unchanged = _context.Conversations.Single(x => x.Id == 30);
            unchanged.Title.Should().Be("Private");
            unchanged.IsArchived.Should().BeFalse();
            unchanged.IsPinned.Should().BeFalse();
        }

        [Fact]
        public async Task ConversationMutations_AllowActiveParticipantInConversationOrganization()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 10, OrganizationId = 50, UserId = 1, IsActive = true, Role = "Owner" });
            _context.Conversations.Add(new Conversation { Id = 31, Title = "Private", LandlordId = 1, OrganizationId = 50 });
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 31, UserId = 1 });
            await _context.SaveChangesAsync();

            (await _repo.UpdateConversation(31, new AddConversationDto { Title = "updated" }, 1)).Title.Should().Be("updated");
            (await _repo.ArchiveConversation(31, true, 1)).IsArchived.Should().BeTrue();
            (await _repo.PinConversation(31, true, 1)).IsPinned.Should().BeTrue();
            (await _repo.DeleteConversation(31, 1)).Should().BeTrue();
        }

        [Fact]
        public async Task AddGroupConversation_RejectsArbitraryParticipantAndCrossOrganizationContext()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Other", "User", "other@example.com");
            _context.Properties.Add(new Property { Id = 200, LandlordId = 1, OrganizationId = 99 });
            await _context.SaveChangesAsync();

            var act = () => _repo.AddConversation(new AddConversationDto
            {
                Title = "Guessed context",
                IsGroupChat = true,
                ParticipantUserIds = [2],
                PropertyId = 200
            }, landlordId: 1, organizationId: 50);

            await act.Should().ThrowAsync<KeyNotFoundException>();
            _context.Conversations.Should().BeEmpty();
        }

        [Fact]
        public async Task AddGroupConversation_AllowsOnlyOrganizationStaffAndTenantWorkflowContext()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Staff", "Member", "staff@example.com");
            SeedUser(3, "Tara", "Tenant", "tenant@example.com");
            _context.OrganizationMembers.AddRange(
                new OrganizationMember { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true },
                new OrganizationMember { Id = 2, OrganizationId = 50, UserId = 2, IsActive = true });
            _context.Tenants.Add(new Tenant { Id = 10, UserId = 3, Firstname = "Tara", Lastname = "Tenant", OrganizationId = 50 });
            _context.Properties.Add(new Property { Id = 200, LandlordId = 1, OrganizationId = 50 });
            _context.Units.Add(new Unit { Id = 300, PropertyId = 200, OrganizationId = 50 });
            _context.Leases.Add(new Lease { Id = 100, UnitId = 300, OrganizationId = 50 });
            _context.TenantLeases.Add(new TenantLease { TenantId = 10, LeaseId = 100 });
            await _context.SaveChangesAsync();

            var result = await _repo.AddConversation(new AddConversationDto
            {
                Title = "Valid workflow",
                IsGroupChat = true,
                ParticipantUserIds = [2, 3],
                PropertyId = 200,
                LeaseId = 100,
                TenantId = 10
            }, landlordId: 1, organizationId: 50);

            result.Participants.Select(x => x.UserId).Should().BeEquivalentTo([1L, 2L, 3L]);
        }

        [Fact]
        public async Task AddDirectConversation_CannotBypassParticipantValidationWithFalseGroupFlag()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Staff", "Member", "staff@example.com");
            SeedUser(3, "Tara", "Tenant", "tenant@example.com");
            _context.OrganizationMembers.AddRange(
                new OrganizationMember { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true },
                new OrganizationMember { Id = 2, OrganizationId = 50, UserId = 2, IsActive = true });
            SeedTenant(10, 3, "tenant@example.com");
            await _context.SaveChangesAsync();

            var act = () => _repo.AddConversation(new AddConversationDto
            {
                Title = "Disguised group",
                IsGroupChat = false,
                ParticipantUserIds = [2, 3],
                TenantId = 10
            }, landlordId: 1, organizationId: 50);

            await act.Should().ThrowAsync<KeyNotFoundException>();
            _context.Conversations.Should().BeEmpty();
        }

        [Fact]
        public async Task AddDirectConversation_RejectsCrossOrganizationParticipantAndMismatchedContextBeforeReuse()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Tara", "Tenant", "tenant@example.com");
            SeedUser(3, "Other", "Tenant", "other@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true });
            SeedTenant(10, 2, "tenant@example.com");
            _context.Tenants.Add(new Tenant
                { Id = 11, UserId = 3, Firstname = "Other", Lastname = "Tenant", OrganizationId = 99 });
            _context.Properties.Add(new Property { Id = 200, LandlordId = 1, OrganizationId = 99 });
            _context.Conversations.Add(new Conversation
                { Id = 40, Title = "Existing", LandlordId = 1, OrganizationId = 50, TenantId = 10 });
            _context.ConversationParticipants.AddRange(
                new ConversationParticipant { ConversationId = 40, UserId = 1 },
                new ConversationParticipant { ConversationId = 40, UserId = 2 });
            await _context.SaveChangesAsync();

            var act = () => _repo.AddConversation(new AddConversationDto
            {
                Title = "Poison existing thread",
                IsGroupChat = false,
                ParticipantUserIds = [3],
                TenantId = 11,
                PropertyId = 200
            }, landlordId: 1, organizationId: 50);

            await act.Should().ThrowAsync<KeyNotFoundException>();
            _context.Conversations.Should().ContainSingle();
            _context.ConversationParticipants.Where(x => x.ConversationId == 40)
                .Select(x => x.UserId).Should().BeEquivalentTo([1L, 2L]);
        }

        [Fact]
        public async Task DeleteConversation_ArchivesConversationAndPreservesTimelineAndDeliveryEvidence()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true });
            _context.Conversations.Add(new Conversation
                { Id = 50, Title = "Evidence", LandlordId = 1, OrganizationId = 50 });
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 50, UserId = 1 });
            _context.Messages.Add(new Message
                { Id = 60, ConversationId = 50, OrganizationId = 50, SenderId = 1, Content = "keep" });
            _context.ConversationTimelineEntries.Add(new ConversationTimelineEntry
            {
                Id = 70, OrganizationId = 50, ConversationId = 50, MessageId = 60, Sequence = 1,
                Kind = TimelineEntryKind.Message, OccurredAtUtc = DateTime.UtcNow, SourceType = "message",
                SourceId = "60", Summary = "keep", Producer = "test", EventId = "message-60",
                PayloadHash = new string('a', 64)
            });
            _context.MessageDeliveries.Add(new MessageDelivery
            {
                Id = 80, OrganizationId = 50, ConversationTimelineEntryId = 70, MessageId = 60,
                Channel = MessageDeliveryChannel.InApp, Status = MessageDeliveryStatus.Delivered,
                RecipientUserId = 1, IdempotencyKey = "delete-evidence", CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            (await _repo.DeleteConversation(50, 1)).Should().BeTrue();

            _context.Conversations.Single(x => x.Id == 50).IsArchived.Should().BeTrue();
            _context.Messages.Should().ContainSingle(x => x.Id == 60);
            _context.ConversationTimelineEntries.Should().ContainSingle(x => x.Id == 70);
            _context.MessageDeliveries.Should().ContainSingle(x => x.Id == 80);
        }

        [Theory]
        [InlineData("update")]
        [InlineData("delete")]
        [InlineData("archive")]
        [InlineData("pin")]
        public async Task ConversationMutations_FailClosed_WhenLegacyOrganizationOwnershipIsUnknown(string operation)
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            _context.Conversations.Add(new Conversation
                { Id = 90, Title = "Unowned legacy", LandlordId = 1, OrganizationId = null });
            _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 90, UserId = 1 });
            await _context.SaveChangesAsync();

            Func<Task> act = operation switch
            {
                "update" => async () => await _repo.UpdateConversation(90, new AddConversationDto { Title = "changed" }, 1),
                "delete" => async () => await _repo.DeleteConversation(90, 1),
                "archive" => async () => await _repo.ArchiveConversation(90, true, 1),
                _ => async () => await _repo.PinConversation(90, true, 1)
            };

            await act.Should().ThrowAsync<KeyNotFoundException>();
            var unchanged = _context.Conversations.Single(x => x.Id == 90);
            unchanged.Title.Should().Be("Unowned legacy");
            unchanged.IsArchived.Should().BeFalse();
            unchanged.IsPinned.Should().BeFalse();
        }

        [Fact]
        public async Task ConversationLists_RequireActiveParticipantAndCurrentOrganizationRelationship()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Staff", "Revoked", "staff@example.com");
            SeedUser(3, "Tara", "Tenant", "tenant@example.com");
            _context.OrganizationMembers.AddRange(
                new OrganizationMember { Id = 1, OrganizationId = 50, UserId = 1, IsActive = false },
                new OrganizationMember { Id = 2, OrganizationId = 50, UserId = 2, IsActive = false });
            SeedTenant(10, 3, "tenant@example.com");
            _context.Conversations.Add(new Conversation
                { Id = 100, Title = "Scoped", LandlordId = 1, OrganizationId = 50, TenantId = 10 });
            _context.ConversationParticipants.AddRange(
                new ConversationParticipant { ConversationId = 100, UserId = 1 },
                new ConversationParticipant { ConversationId = 100, UserId = 2 },
                new ConversationParticipant { ConversationId = 100, UserId = 3 });
            await _context.SaveChangesAsync();

            (await _repo.GetConversationsByLandlordId(1)).Should().BeEmpty("the landlord membership was revoked");
            (await _repo.GetConversationsByParticipantUserId(2)).Should().BeEmpty("the staff membership was revoked");
            (await _repo.GetConversationsByParticipantUserId(3)).Should().ContainSingle(x => x.Id == 100,
                "the tenant still has a current tenant relationship in the conversation organization");

            _context.OrganizationMembers.Single(x => x.UserId == 1).IsActive = true;
            _context.ConversationParticipants.Single(x => x.UserId == 1).IsDeleted = true;
            await _context.SaveChangesAsync();
            (await _repo.GetConversationsByLandlordId(1)).Should().BeEmpty("soft-deleted participants fail closed");
        }

        [Fact]
        public async Task ConversationListUnread_UsesVisibleTimelineWatermarkAcrossKinds_AndExcludesOwnEntries()
        {
            SeedUser(1, "Land", "Lord", "landlord@example.com");
            SeedUser(2, "Tara", "Tenant", "tenant@example.com");
            _context.OrganizationMembers.Add(new OrganizationMember
                { Id = 1, OrganizationId = 50, UserId = 1, IsActive = true });
            SeedTenant(10, 2, "tenant@example.com");
            _context.Conversations.Add(new Conversation
                { Id = 101, Title = "Unified unread", LandlordId = 1, OrganizationId = 50, TenantId = 10 });
            _context.ConversationParticipants.AddRange(
                new ConversationParticipant { ConversationId = 101, UserId = 1 },
                new ConversationParticipant { ConversationId = 101, UserId = 2 });
            _context.ConversationTimelineEntries.AddRange(
                TimelineEntry(101, 1, TimelineEntryKind.InboundSms, 1, TimelineVisibility.Participants),
                TimelineEntry(101, 2, TimelineEntryKind.Email, 2, TimelineVisibility.Participants),
                TimelineEntry(101, 3, TimelineEntryKind.Reminder, null, TimelineVisibility.StaffOnly),
                TimelineEntry(101, 4, TimelineEntryKind.System, null, TimelineVisibility.Participants),
                TimelineEntry(101, 5, TimelineEntryKind.Maintenance, 1, TimelineVisibility.Participants));
            _context.ConversationReadWatermarks.Add(new ConversationReadWatermark
                { ConversationId = 101, UserId = 2, LastReadSequence = 1, UpdatedAtUtc = DateTime.UtcNow });
            _context.Messages.Add(new Message
                { Id = 500, ConversationId = 101, OrganizationId = 50, SenderId = 1, Content = "legacy unread" });
            await _context.SaveChangesAsync();

            var result = await _repo.GetConversationsByParticipantUserId(2);

            result.Should().ContainSingle().Which.UnreadCount.Should().Be(2,
                "all visible shared timeline kinds after the watermark are unread");
        }

        private static ConversationTimelineEntry TimelineEntry(long conversationId, long sequence,
            TimelineEntryKind kind, long? actorUserId, TimelineVisibility visibility) => new()
        {
            OrganizationId = 50, ConversationId = conversationId, Sequence = sequence, Kind = kind,
            ActorUserId = actorUserId, OccurredAtUtc = DateTime.UtcNow, SourceType = "test",
            SourceId = sequence.ToString(), Summary = kind.ToString(), Producer = "tests",
            EventId = $"{conversationId}-{sequence}", PayloadHash = new string('a', 64), Visibility = visibility
        };

        private void SeedUser(long id, string firstName, string lastName, string email)
        {
            _context.Users.Add(new User
            {
                Id = id,
                SettingId = id,
                FirstName = firstName,
                LastName = lastName,
                Email = email
            });
        }

        private void SeedTenant(long id, long userId, string email)
        {
            _context.Tenants.Add(new Tenant
            {
                Id = id,
                UserId = userId,
                Firstname = "Tara",
                Lastname = "Tenant",
                Email = email,
                OrganizationId = 50
            });
        }
    }
}
