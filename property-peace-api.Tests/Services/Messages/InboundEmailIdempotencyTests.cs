using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Services.EmailSyncService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Messages;

public sealed class InboundEmailIdempotencyTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();

    [Fact]
    public async Task ExactProviderReplay_DoesNotDuplicateNotificationsOrSignalR()
    {
        _context.Users.AddRange(
            new User { Id = 1, SettingId = 1, Email = "tenant@example.test", FirstName = "T" },
            new User { Id = 2, SettingId = 2, Email = "landlord@example.test", FirstName = "L" });
        _context.Conversations.Add(new Conversation
        {
            Id = 10, OrganizationId = 100, LandlordId = 2, Title = "Lease", CreatedAt = DateTime.UtcNow
        });
        _context.ConversationParticipants.Add(new ConversationParticipant { ConversationId = 10, UserId = 1 });
        await _context.SaveChangesAsync();

        AddMessageDto? captured = null;
        var messages = new Mock<IMessageRepository>();
        messages.Setup(x => x.AddMessage(It.IsAny<AddMessageDto>(), 1))
            .Callback<AddMessageDto, long>((dto, _) => captured = dto)
            .ReturnsAsync(new LoadMessageDto { Id = 50, ConversationId = 10, SenderId = 1, WasReplayed = true });
        var notifications = new Mock<INotificationService>();
        var hub = new Mock<IHubContext<ConversationHub>>();
        var service = new InboundEmailService(_context, messages.Object, notifications.Object, hub.Object,
            Mock.Of<ILogger<InboundEmailService>>());

        var handled = await service.HandleInboundAsync("Tenant <tenant@example.test>", "reply+PP-C10@example.test",
            null, "same body", null, "mail-event-7");

        handled.Should().BeTrue();
        captured!.Channel.Should().Be("email");
        captured.ClientRequestId.Should().Be("email-inbound:mail-event-7");
        captured.TrustedProviderPayloadHash.Should().MatchRegex("^[0-9a-f]{64}$");
        notifications.VerifyNoOtherCalls();
        hub.VerifyNoOtherCalls();
    }

    public void Dispose() => _context.Dispose();
}
