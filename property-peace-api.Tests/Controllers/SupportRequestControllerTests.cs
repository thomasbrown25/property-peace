using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.SupportRequest;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.SupportRequestService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class SupportRequestControllerTests : IDisposable
{
    private readonly DataContext _context;
    private readonly MessageRepository _messageRepository;
    private readonly ConversationRepository _conversationRepository;
    private readonly Mock<IUserRepository> _userRepository = new();
    private readonly Mock<INotificationService> _notificationService = new();
    private readonly SupportRequestController _controller;

    public SupportRequestControllerTests()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        _context = new DataContext(options);
        _conversationRepository = new ConversationRepository(
            _context,
            new Mock<ILogger<ConversationRepository>>().Object,
            MapperFactory.Create());
        _messageRepository = new MessageRepository(
            _context,
            new Mock<ILogger<MessageRepository>>().Object,
            MapperFactory.Create());

        _userRepository.Setup(repository => repository.GetCurrentUser()).ReturnsAsync(new LoadUserDto
        {
            Id = 1,
            Firstname = "Land",
            Lastname = "Lord",
            Email = "landlord@example.com",
            CurrentOrganizationId = 50
        });
        _notificationService
            .Setup(service => service.CreateNotification(It.IsAny<CreateNotificationDto>()))
            .ReturnsAsync(ServiceResponse<NotificationDto>.CreateSuccess(new NotificationDto()));

        _controller = new SupportRequestController(
            new Mock<ISupportRequestService>().Object,
            _userRepository.Object,
            _conversationRepository,
            _messageRepository,
            _notificationService.Object,
            _context,
            new Mock<ILogger<SupportRequestController>>().Object);

        var httpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "1"), new Claim(ClaimTypes.Role, "Landlord")],
                "test"))
        };
        httpContext.Items["OrganizationId"] = 50L;
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task LinkedTicket_DeniesRequesterWithoutSelectedOrganization()
    {
        _context.Users.Add(new User
        {
            Id = 1,
            SettingId = 1,
            FirstName = "Land",
            LastName = "Lord",
            Email = "landlord@example.com"
        });
        _context.Conversations.Add(new Conversation
        {
            Id = 10,
            Title = "Support: Scoped issue",
            LandlordId = 1,
            OrganizationId = 50
        });
        _context.ConversationParticipants.Add(new ConversationParticipant
        {
            Id = 1,
            ConversationId = 10,
            UserId = 1
        });
        _context.SupportAndFeedbacks.Add(new SupportAndFeedback
        {
            Id = 9,
            UserId = 1,
            Subject = "Scoped issue",
            Message = "Organization-specific details",
            TicketNumber = "PP-2026-000009",
            ConversationId = 10
        });
        await _context.SaveChangesAsync();
        _controller.ControllerContext.HttpContext.Items.Remove("OrganizationId");

        var detailResult = await _controller.GetTicket(9);
        var replyResult = await _controller.Reply(9, new ReplyToSupportTicketDto { Message = "Unscoped reply" });

        detailResult.Should().BeOfType<NotFoundObjectResult>();
        replyResult.Should().BeOfType<NotFoundObjectResult>();
        _context.Messages.Should().BeEmpty();
    }

    [Fact]
    public async Task LinkedTicket_DeniesAdminWhoIsNotAnExplicitParticipant()
    {
        _context.Users.AddRange(
            new User { Id = 1, SettingId = 1, FirstName = "Land", LastName = "Lord", Email = "landlord@example.com" },
            new User { Id = 2, SettingId = 2, FirstName = "Assigned", LastName = "Admin", Email = "assigned@example.com" },
            new User { Id = 3, SettingId = 3, FirstName = "Other", LastName = "Admin", Email = "other@example.com" });
        _context.Roles.Add(new Role { Id = 10, RoleName = "Admin" });
        _context.UserRoles.AddRange(
            new UserRole { UserId = 2, RoleId = 10 },
            new UserRole { UserId = 3, RoleId = 10 });
        _context.Conversations.Add(new Conversation
        {
            Id = 10,
            Title = "Support: Private issue",
            LandlordId = 1,
            OrganizationId = 50
        });
        _context.ConversationParticipants.AddRange(
            new ConversationParticipant { Id = 1, ConversationId = 10, UserId = 1 },
            new ConversationParticipant { Id = 2, ConversationId = 10, UserId = 2 });
        _context.SupportAndFeedbacks.Add(new SupportAndFeedback
        {
            Id = 8,
            UserId = 1,
            Subject = "Private issue",
            Message = "Sensitive details",
            TicketNumber = "PP-2026-000008",
            ConversationId = 10
        });
        await _context.SaveChangesAsync();

        _userRepository.Setup(repository => repository.GetCurrentUser()).ReturnsAsync(new LoadUserDto
        {
            Id = 3,
            Firstname = "Other",
            Lastname = "Admin",
            Email = "other@example.com"
        });
        _controller.ControllerContext.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "3"), new Claim(ClaimTypes.Role, "Admin")],
            "test"));

        var detailResult = await _controller.GetTicket(8);
        var replyResult = await _controller.Reply(8, new ReplyToSupportTicketDto { Message = "Unauthorized reply" });

        detailResult.Should().BeOfType<NotFoundObjectResult>();
        replyResult.Should().BeOfType<NotFoundObjectResult>();
        _context.Messages.Should().BeEmpty();
    }

    [Fact]
    public async Task Reply_LazilyCreatesThreadForLegacyTicket_SeedsOriginalOnce_AndAllowsAdminAccess()
    {
        _context.Users.AddRange(
            new User
            {
                Id = 1,
                SettingId = 1,
                FirstName = "Land",
                LastName = "Lord",
                Email = "landlord@example.com",
                CurrentOrganizationId = 50
            },
            new User
            {
                Id = 2,
                SettingId = 2,
                FirstName = "Support",
                LastName = "Admin",
                Email = "admin@example.com"
            });
        _context.OrganizationMembers.Add(new OrganizationMember
        {
            Id = 1,
            OrganizationId = 50,
            UserId = 1,
            IsActive = true,
            Role = "Owner"
        });
        _context.Roles.Add(new Role { Id = 10, RoleName = "Admin" });
        _context.UserRoles.Add(new UserRole { UserId = 2, RoleId = 10 });
        _context.SupportAndFeedbacks.Add(new SupportAndFeedback
        {
            Id = 7,
            UserId = 1,
            Subject = "Legacy issue",
            Message = "Original legacy request",
            SubType = "bug",
            TicketNumber = "PP-2026-000007",
            ConversationId = null
        });
        await _context.SaveChangesAsync();

        var firstResult = await _controller.Reply(7, new ReplyToSupportTicketDto { Message = "First follow-up" });
        var secondResult = await _controller.Reply(7, new ReplyToSupportTicketDto { Message = "Second follow-up" });

        firstResult.Should().BeOfType<OkObjectResult>();
        secondResult.Should().BeOfType<OkObjectResult>();
        var ticket = _context.SupportAndFeedbacks.Single(item => item.Id == 7);
        ticket.ConversationId.Should().NotBeNull();
        _context.Conversations.Should().ContainSingle(conversation => conversation.Id == ticket.ConversationId);
        _context.ConversationParticipants
            .Where(participant => participant.ConversationId == ticket.ConversationId && !participant.IsDeleted)
            .Select(participant => participant.UserId)
            .Should().BeEquivalentTo([1L, 2L]);
        _context.Messages
            .Where(message => message.ConversationId == ticket.ConversationId && !message.IsDeleted)
            .OrderBy(message => message.CreatedAt)
            .Select(message => message.Content)
            .Should().BeEquivalentTo(
                ["Original legacy request", "First follow-up", "Second follow-up"],
                options => options.WithStrictOrdering());

        var adminMessages = await _messageRepository.GetMessagesByConversationId(ticket.ConversationId!.Value, 2);
        adminMessages.Should().HaveCount(3);
    }
}
