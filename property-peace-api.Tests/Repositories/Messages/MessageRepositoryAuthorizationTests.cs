using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Messages;

public class MessageRepositoryAuthorizationTests : IDisposable
{
    private readonly DataContext _context;
    private readonly MessageRepository _repo;

    public MessageRepositoryAuthorizationTests()
    {
        _context = DbContextFactory.Create();
        _repo = new MessageRepository(
            _context,
            new Mock<ILogger<MessageRepository>>().Object,
            MapperFactory.Create());
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetMessagesByConversationId_ThrowsNotFound_WhenActorIsNotActiveParticipant()
    {
        await SeedConversationAsync();

        var act = () => _repo.GetMessagesByConversationId(10, 2);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task AddMessage_ThrowsNotFound_WhenSenderIsNotActiveParticipant()
    {
        await SeedConversationAsync();

        var act = () => _repo.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "intrusion"
        }, 2);

        await act.Should().ThrowAsync<KeyNotFoundException>();
        _context.Messages.Should().BeEmpty();
    }

    [Fact]
    public async Task AddMessage_ThrowsNotFound_WhenReplyTargetsDifferentConversation()
    {
        await SeedConversationAsync();
        _context.Conversations.Add(new Conversation { Id = 11, Title = "Other", LandlordId = 1 });
        _context.Messages.Add(new Message { Id = 101, ConversationId = 11, SenderId = 1, Content = "other" });
        await _context.SaveChangesAsync();

        var act = () => _repo.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "bad reply",
            ReplyToMessageId = 101
        }, 1);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task MarkMessageAsRead_ThrowsNotFound_WhenActorIsNotActiveParticipant()
    {
        await SeedConversationAsync(withMessage: true);

        var act = () => _repo.MarkMessageAsRead(100, 2);

        await act.Should().ThrowAsync<KeyNotFoundException>();
        _context.MessageReads.Should().BeEmpty();
    }

    [Fact]
    public async Task MarkConversationAsRead_ThrowsNotFound_WhenActorIsNotActiveParticipant()
    {
        await SeedConversationAsync(withMessage: true);

        var act = () => _repo.MarkConversationAsRead(10, 2);

        await act.Should().ThrowAsync<KeyNotFoundException>();
        _context.MessageReads.Should().BeEmpty();
    }

    [Fact]
    public async Task GetMessageById_ReturnsNull_WhenActorIsNotActiveParticipant()
    {
        await SeedConversationAsync(withMessage: true);

        var result = await _repo.GetMessageById(100, 2);

        result.Should().BeNull();
    }

    [Fact]
    public async Task UpdateMessage_ThrowsNotFound_WhenActorIsNotSender()
    {
        await SeedConversationAsync(withMessage: true, secondUserIsParticipant: true);

        var act = () => _repo.UpdateMessage(100, "tampered", 2);

        await act.Should().ThrowAsync<KeyNotFoundException>();
        _context.Messages.Single(m => m.Id == 100).Content.Should().Be("private");
    }

    [Fact]
    public async Task DeleteMessage_ReturnsFalse_WhenActorIsNotSender()
    {
        await SeedConversationAsync(withMessage: true, secondUserIsParticipant: true);

        var result = await _repo.DeleteMessage(100, 2);

        result.Should().BeFalse();
        _context.Messages.Single(m => m.Id == 100).IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task SenderWithActiveMembership_CanReadUpdateAndDeleteOwnMessage()
    {
        await SeedConversationAsync(withMessage: true);

        (await _repo.GetMessageById(100, 1)).Should().NotBeNull();
        (await _repo.UpdateMessage(100, "edited", 1)).Content.Should().Be("edited");
        (await _repo.DeleteMessage(100, 1)).Should().BeTrue();
    }

    [Fact]
    public async Task PointOperations_DenyStaleParticipant_WhenOrganizationMembershipIsInactive()
    {
        await SeedConversationAsync(withMessage: true, activeOrganizationMembership: false);

        (await _repo.GetMessageById(100, 1)).Should().BeNull();
        await FluentActions.Invoking(() => _repo.UpdateMessage(100, "edited", 1))
            .Should().ThrowAsync<KeyNotFoundException>();
        (await _repo.DeleteMessage(100, 1)).Should().BeFalse();
        await FluentActions.Invoking(() => _repo.MarkMessageAsRead(100, 1))
            .Should().ThrowAsync<KeyNotFoundException>();

        _context.Messages.Single(m => m.Id == 100).Content.Should().Be("private");
        _context.Messages.Single(m => m.Id == 100).IsDeleted.Should().BeFalse();
        _context.MessageReads.Should().BeEmpty();
    }

    [Fact]
    public async Task SetMessageUrgent_RequiresMatchingConversationAndOrganization()
    {
        await SeedConversationAsync(withMessage: true);

        (await _repo.SetMessageUrgent(100, true, 999, 100, 1)).Should().BeFalse();
        (await _repo.SetMessageUrgent(100, true, 10, 999, 1)).Should().BeFalse();
        _context.Messages.Single(m => m.Id == 100).IsUrgent.Should().BeFalse();

        (await _repo.SetMessageUrgent(100, true, 10, 100, 1)).Should().BeTrue();
        _context.Messages.Single(m => m.Id == 100).IsUrgent.Should().BeTrue();

        (await _repo.SetConversationUrgent(10, false, 999, 1)).Should().BeFalse();
        (await _repo.SetConversationUrgent(10, false, 100, 2)).Should().BeFalse();
        _context.Messages.Single(m => m.Id == 100).IsUrgent.Should().BeTrue();
        (await _repo.SetConversationUrgent(10, false, 100, 1)).Should().BeTrue();
        _context.Messages.Single(m => m.Id == 100).IsUrgent.Should().BeFalse();
    }

    private async Task SeedConversationAsync(bool withMessage = false, bool secondUserIsParticipant = false,
        bool activeOrganizationMembership = true)
    {
        _context.Users.AddRange(
            new User { Id = 1, SettingId = 1, FirstName = "Sender", LastName = "One", Email = "one@example.com" },
            new User { Id = 2, SettingId = 2, FirstName = "Out", LastName = "Sider", Email = "two@example.com" });
        _context.Conversations.Add(new Conversation { Id = 10, OrganizationId = 100, Title = "Private", LandlordId = 1 });
        _context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1,
            OrganizationId = 100,
            UserId = 1,
            Role = "Manager",
            IsActive = activeOrganizationMembership
        });
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            ConversationId = 10,
            UserId = 1
        });
        if (secondUserIsParticipant)
        {
            _context.ConversationParticipants.Add(new ConversationParticipant
            {
                ConversationId = 10,
                UserId = 2
            });
        }
        if (withMessage)
        {
            _context.Messages.Add(new Message
            {
                Id = 100,
                ConversationId = 10,
                OrganizationId = 100,
                SenderId = 1,
                Content = "private"
            });
        }
        await _context.SaveChangesAsync();
    }
}
