using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.ConversationService;
using brownstone_hub_api.Services.MessageAnalysisService;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class ConversationOrganizationListSecurityTests
{
    [Fact]
    public async Task LandlordList_ControllerAndService_RejectRevokedMemberWithStaleOrganizationContext()
    {
        var conversations = new Mock<IConversationRepository>(MockBehavior.Strict);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = false });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);
        var controller = Controller(service, http.HttpContext!);

        var result = await controller.GetConversations();

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        conversations.Verify(x => x.GetConversationsByOrganizationId(It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task LandlordList_Service_PassesActorAndReturnsOnlyRepositoryAuthorizedResults()
    {
        var expected = new List<LoadConversationDto> { new() { Id = 9 } };
        var conversations = new Mock<IConversationRepository>();
        conversations.Setup(x => x.GetConversationsByOrganizationId(100, false, 7)).ReturnsAsync(expected);
        var members = new Mock<IOrganizationMemberRepository>();
        members.Setup(x => x.GetMemberAsync(100, 7)).ReturnsAsync(new brownstone_hub_api.Models.OrganizationMember
            { OrganizationId = 100, UserId = 7, IsActive = true });
        var http = new HttpContextAccessor { HttpContext = Context(7, 100) };
        var service = new ConversationService(conversations.Object, Mock.Of<IUserRepository>(), null, http, null,
            NullLogger<ConversationService>.Instance, members.Object);

        var response = await service.GetConversationsByLandlordId(7);

        response.Success.Should().BeTrue();
        response.Data.Should().BeEquivalentTo(expected);
        conversations.VerifyAll();
    }

    private static DefaultHttpContext Context(long userId, long organizationId)
    {
        var context = new DefaultHttpContext();
        context.Items["OrganizationId"] = organizationId;
        context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test"));
        return context;
    }

    private static ConversationController Controller(IConversationService service, HttpContext context)
    {
        var controller = new ConversationController(service, Mock.Of<IUserService>(), null,
            Mock.Of<IActionSuppressionService>(), Mock.Of<IMessageRepository>(), Mock.Of<IMilestone7ConversationService>(),
            NullLogger<ConversationController>.Instance);
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return controller;
    }
}
