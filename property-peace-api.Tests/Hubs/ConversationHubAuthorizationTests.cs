using System.Security.Claims;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Users;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Hubs;

public class ConversationHubAuthorizationTests
{
    [Fact]
    public async Task JoinConversation_RefusesNonParticipantWithoutJoiningGroup()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42, validatedOrganizationId: 7);
        fixture.Conversations
            .Setup(r => r.GetConversationById(10, 42, 7))
            .ReturnsAsync((LoadConversationDto)null!);

        var act = () => fixture.Hub.JoinConversation(10);

        await act.Should().ThrowAsync<HubException>();
        fixture.Groups.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task JoinConversation_JoinsGroup_WhenNumericActorIsActiveParticipantInOrganization()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42, validatedOrganizationId: 7);
        fixture.Conversations
            .Setup(r => r.GetConversationById(10, 42, 7))
            .ReturnsAsync(new LoadConversationDto { Id = 10 });

        await fixture.Hub.JoinConversation(10);

        fixture.Groups.Verify(g => g.AddToGroupAsync(
            "connection-1", "conversation_10", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task JoinConversation_RefusesUnresolvableNonNumericIdentity()
    {
        var fixture = CreateHub(userIdClaim: "not-a-number");

        var act = () => fixture.Hub.JoinConversation(10);

        await act.Should().ThrowAsync<HubException>();
        fixture.Groups.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task JoinConversation_RefusesConnectionWithoutValidatedOrganizationContext()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42);

        var act = () => fixture.Hub.JoinConversation(10);

        await act.Should().ThrowAsync<HubException>();
        fixture.Conversations.Verify(r => r.GetConversationById(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        fixture.Groups.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task JoinConversation_DoesNotAuthorizeParticipantFromAnotherOrganization()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42, validatedOrganizationId: 7);
        fixture.Conversations
            .Setup(r => r.GetConversationById(10, 42, 7))
            .ReturnsAsync((LoadConversationDto)null!);

        var act = () => fixture.Hub.JoinConversation(10);

        await act.Should().ThrowAsync<HubException>();
        fixture.Conversations.Verify(r => r.GetConversationById(10, 42, 7), Times.Once);
        fixture.Conversations.Verify(r => r.GetConversationById(10, 42), Times.Never);
        fixture.Groups.Verify(g => g.AddToGroupAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task LeaveConversation_RemovesGroup_WhenActorIsActiveParticipantInOrganization()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42, validatedOrganizationId: 7);
        fixture.Conversations
            .Setup(r => r.GetConversationById(10, 42, 7))
            .ReturnsAsync(new LoadConversationDto { Id = 10 });

        await fixture.Hub.LeaveConversation(10);

        fixture.Groups.Verify(g => g.RemoveFromGroupAsync(
            "connection-1", "conversation_10", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LeaveConversation_DoesNotRemoveGroup_WhenActorIsNotParticipantInActiveOrganization()
    {
        var fixture = CreateHub(userIdClaim: "42", validatedUserId: 42, validatedOrganizationId: 7);
        fixture.Conversations
            .Setup(r => r.GetConversationById(10, 42, 7))
            .ReturnsAsync((LoadConversationDto)null!);

        var act = () => fixture.Hub.LeaveConversation(10);

        await act.Should().ThrowAsync<HubException>();
        fixture.Groups.Verify(g => g.RemoveFromGroupAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OnConnected_UsesMiddlewareValidatedNumericUserGroup()
    {
        var fixture = CreateHub(
            userIdClaim: "person@example.com",
            validatedUserId: 42,
            validatedOrganizationId: 7);
        fixture.Users.Setup(r => r.GetUser("person@example.com"))
            .ReturnsAsync(new LoadUserDto { Id = 42, Email = "person@example.com" });

        await fixture.Hub.OnConnectedAsync();

        fixture.Groups.Verify(g => g.AddToGroupAsync(
            "connection-1", "user_42", It.IsAny<CancellationToken>()), Times.Once);
        fixture.Groups.Verify(g => g.AddToGroupAsync(
            "connection-1", "user_person@example.com", It.IsAny<CancellationToken>()), Times.Never);
    }

    private static HubFixture CreateHub(
        string userIdClaim,
        long? validatedUserId = null,
        long? validatedOrganizationId = null)
    {
        var users = new Mock<IUserRepository>();
        var conversations = new Mock<IConversationRepository>();
        var groups = new Mock<IGroupManager>();
        var context = new Mock<HubCallerContext>();
        context.SetupGet(c => c.ConnectionId).Returns("connection-1");
        context.SetupGet(c => c.User).Returns(new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userIdClaim)], "test")));

        var httpContext = new DefaultHttpContext();
        if (validatedUserId.HasValue) httpContext.Items["UserId"] = validatedUserId.Value;
        if (validatedOrganizationId.HasValue) httpContext.Items["OrganizationId"] = validatedOrganizationId.Value;
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.SetupGet(a => a.HttpContext).Returns(httpContext);

        var hub = new ConversationHub(
            users.Object,
            conversations.Object,
            httpContextAccessor.Object,
            new Mock<ILogger<ConversationHub>>().Object)
        {
            Context = context.Object,
            Groups = groups.Object
        };

        return new HubFixture(hub, users, conversations, groups);
    }

    private sealed record HubFixture(
        ConversationHub Hub,
        Mock<IUserRepository> Users,
        Mock<IConversationRepository> Conversations,
        Mock<IGroupManager> Groups);
}
