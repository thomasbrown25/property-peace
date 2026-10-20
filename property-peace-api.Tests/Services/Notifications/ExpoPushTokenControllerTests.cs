using brownstone_hub_api.Controllers;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.PushNotifications;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Notifications;

public sealed class ExpoPushTokenControllerTests
{
    [Theory]
    [InlineData("not-an-expo-token")]
    [InlineData("ExpoPushToken[abc]garbage")]
    [InlineData(null)]
    public async Task RejectsInvalidTokens(string? token)
    {
        var tokens = new Mock<IExpoPushTokenService>();
        var controller = new ExpoPushTokenController(Mock.Of<IUserService>(), tokens.Object);
        (await controller.Register(new ExpoPushTokenRequest(token))).Should().BeOfType<BadRequestObjectResult>();
        tokens.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RegistersAndUnregistersOnlyForAuthenticatedUser()
    {
        var users = new Mock<IUserService>();
        users.Setup(x => x.GetCurrentUserIdAsync()).ReturnsAsync(new ServiceResponse<long?> { Data = 17 });
        var tokens = new Mock<IExpoPushTokenService>();
        var controller = new ExpoPushTokenController(users.Object, tokens.Object);
        var request = new ExpoPushTokenRequest("ExpoPushToken[abc_def-123]");

        (await controller.Register(request)).Should().BeOfType<NoContentResult>();
        (await controller.Unregister(request)).Should().BeOfType<NoContentResult>();
        tokens.Verify(x => x.RegisterAsync(17, request.Token!), Times.Once());
        tokens.Verify(x => x.UnregisterAsync(17, request.Token!), Times.Once());
    }
}
