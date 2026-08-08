using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.MessageService;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Messages;

public class MessageServiceAuthorizationTests
{
    [Fact]
    public async Task GetMessages_ReturnsNotFound_WhenRepositoryHidesInaccessibleConversation()
    {
        var messages = new Mock<IMessageRepository>();
        var users = AuthenticatedUser();
        messages.Setup(r => r.GetMessagesByConversationId(10, 42, 0, 50))
            .ThrowsAsync(new KeyNotFoundException("Conversation not found"));
        var service = CreateService(messages, users);

        var response = await service.GetMessagesByConversationId(10);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(404);
        response.Message.Should().Be("Conversation not found");
    }

    [Fact]
    public async Task AddMessage_ReturnsNotFound_WhenRepositoryHidesInaccessibleConversation()
    {
        var messages = new Mock<IMessageRepository>();
        var users = AuthenticatedUser();
        messages.Setup(r => r.AddMessage(It.IsAny<AddMessageDto>(), 42))
            .ThrowsAsync(new KeyNotFoundException("Conversation not found"));
        var service = CreateService(messages, users);

        var response = await service.AddMessage(new AddMessageDto
        {
            ConversationId = 10,
            Content = "private"
        });

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(404);
        response.Message.Should().Be("Conversation not found");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MarkRead_ReturnsNotFound_WhenRepositoryHidesInaccessibleConversation(bool singleMessage)
    {
        var messages = new Mock<IMessageRepository>();
        var users = AuthenticatedUser();
        messages.Setup(r => r.MarkMessageAsRead(20, 42))
            .ThrowsAsync(new KeyNotFoundException("Message not found"));
        messages.Setup(r => r.MarkConversationAsRead(10, 42))
            .ThrowsAsync(new KeyNotFoundException("Conversation not found"));
        var service = CreateService(messages, users);

        var response = singleMessage
            ? await service.MarkMessageAsRead(20)
            : await service.MarkConversationAsRead(10);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(404);
    }

    private static Mock<IUserRepository> AuthenticatedUser()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(r => r.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 42 });
        return users;
    }

    private static MessageService CreateService(
        Mock<IMessageRepository> messages,
        Mock<IUserRepository> users) => new(
            messages.Object,
            users.Object,
            Mock.Of<IConversationRepository>(),
            Mock.Of<IMessageAnalysisService>(),
            Mock.Of<IActionSuppressionService>(),
            Mock.Of<IServiceScopeFactory>(),
            Mock.Of<ILogger<MessageService>>());
}
