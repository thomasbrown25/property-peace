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
            SeedTenant(11, 2, "tenant@example.com");
            await _context.SaveChangesAsync();

            var first = await _repo.AddConversation(new AddConversationDto
            {
                Title = "Original tenant row",
                TenantId = 10,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            var second = await _repo.AddConversation(new AddConversationDto
            {
                Title = "New tenant row, same person",
                TenantId = 11,
                ParticipantUserIds = [2]
            }, landlordId: 1, organizationId: 50);

            second.Id.Should().Be(first.Id);
            _context.Conversations.Count(c => !c.IsGroupChat && c.LandlordId == 1).Should().Be(1);
        }

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
