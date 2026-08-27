using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Mfa;
using brownstone_hub_api.Dtos.User;
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
    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task VerifyLogin_UsesRememberMeToChooseCookieLifetime(bool rememberMe, bool expectsExpires)
    {
        var challengeId = Guid.NewGuid();
        var mfa = new Mock<IMfaService>();
        mfa.Setup(service => service.VerifyLoginAsync(challengeId, "123456", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MfaVerificationResult(true, 42));

        var users = new Mock<IUserService>();
        users.Setup(service => service.CreateRefreshSession(42, rememberMe))
            .ReturnsAsync(new RefreshSessionDto
            {
                User = new LoadUserDto { Id = 42, Email = "user@example.test" },
                RefreshToken = "refresh-token",
                RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30),
                IsPersistent = rememberMe
            });

        var environment = new Mock<IWebHostEnvironment>();
        environment.SetupGet(value => value.EnvironmentName).Returns("Development");
        var controller = new MfaController(mfa.Object, users.Object, environment.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        await controller.VerifyLogin(new VerifyMfaRequest(challengeId, "123456", rememberMe), default);

        controller.Response.Headers.SetCookie.ToString().ToLowerInvariant().Contains("expires=").Should().Be(expectsExpires);
    }

    [Fact]
    public async Task VerifyLogin_WhenRememberMeIsOmitted_PreservesLegacyPersistentSession()
    {
        var challengeId = Guid.NewGuid();
        var mfa = new Mock<IMfaService>();
        mfa.Setup(service => service.VerifyLoginAsync(challengeId, "123456", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MfaVerificationResult(true, 42));

        var users = new Mock<IUserService>();
        users.Setup(service => service.CreateRefreshSession(42, true))
            .ReturnsAsync(new RefreshSessionDto
            {
                User = new LoadUserDto { Id = 42, Email = "user@example.test" },
                RefreshToken = "refresh-token",
                RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30),
                IsPersistent = true
            });

        var environment = new Mock<IWebHostEnvironment>();
        environment.SetupGet(value => value.EnvironmentName).Returns("Development");
        var controller = new MfaController(mfa.Object, users.Object, environment.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        await controller.VerifyLogin(new VerifyMfaRequest(challengeId, "123456"), default);

        users.Verify(service => service.CreateRefreshSession(42, true), Times.Once);
        controller.Response.Headers.SetCookie.ToString().ToLowerInvariant().Should().Contain("expires=");
    }

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
