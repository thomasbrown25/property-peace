using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Mfa;
using brownstone_hub_api.Services.MfaService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class MfaControllerTests
{
    [Fact]
    public async Task Status_WithApplicationUserIdClaim_ReturnsMfaStatus()
    {
        var mfa = new Mock<IMfaService>();
        var expected = new MfaStatusDto(false, null, false);
        mfa.Setup(service => service.GetStatusAsync(42, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var controller = new MfaController(
            mfa.Object,
            Mock.Of<IUserService>(),
            Mock.Of<IWebHostEnvironment>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim("userId", "42")],
                        authenticationType: "test"))
                }
            }
        };

        var result = await controller.Status(default);

        result.Result.Should().BeOfType<OkObjectResult>()
            .Which.Value.Should().Be(expected);
        mfa.Verify(service => service.GetStatusAsync(42, It.IsAny<CancellationToken>()), Times.Once);
    }
}
