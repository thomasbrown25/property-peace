using Azure.Storage.Blobs;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.BotChallenge;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.EmailVerificationService;
using brownstone_hub_api.Services.GoogleAuthService;
using brownstone_hub_api.Services.MfaService;
using brownstone_hub_api.Services.NotificationSettingService;
using brownstone_hub_api.Services.PasswordReset;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers.Auth;

public sealed class UserLoginRememberMeTests
{
    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task Login_UsesRememberMeToChooseCookieLifetime(bool rememberMe, bool expectsExpires)
    {
        var users = new Mock<IUserService>();
        var user = new LoadUserDto { Id = 42, Email = "user@example.test" };
        users.Setup(service => service.Login("user@example.test", "password")).ReturnsAsync(ServiceResponse<LoadUserDto>.CreateSuccess(user));
        users.Setup(service => service.CreateRefreshSession(42, rememberMe)).ReturnsAsync(new RefreshSessionDto
        {
            User = user,
            RefreshToken = "refresh-token",
            RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30),
            IsPersistent = rememberMe
        });

        var mfa = new Mock<IMfaService>();
        mfa.Setup(service => service.HasEnabledMfaAsync(42, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        await using var dataContext = new DataContext(
            new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var environment = new Mock<IWebHostEnvironment>();
        environment.SetupGet(value => value.EnvironmentName).Returns("Development");
        using var services = new ServiceCollection().AddSingleton(environment.Object).BuildServiceProvider();
        var controller = CreateController(users.Object, mfa.Object, dataContext);
        controller.ControllerContext = new ControllerContext
            { HttpContext = new DefaultHttpContext { RequestServices = services } };

        await controller.Login(new UserLoginDto { Email = "user@example.test", Password = "password", RememberMe = rememberMe }, default);

        controller.Response.Headers.SetCookie.ToString().ToLowerInvariant().Contains("expires=").Should().Be(expectsExpires);
    }

    private static UserController CreateController(IUserService users, IMfaService mfa, DataContext dataContext) => new(
        users,
        Mock.Of<INotificationSettingService>(),
        dataContext,
        new BlobServiceClient(new Uri("https://example.blob.core.windows.net")),
        Mock.Of<IAzureBlobService>(),
        Mock.Of<IEmailVerificationService>(),
        Mock.Of<IBotChallengeVerifier>(),
        Mock.Of<IGoogleAuthService>(),
        Mock.Of<IConversationRepository>(),
        Mock.Of<IMessageRepository>(),
        Mock.Of<IAdminSettingsRepository>(),
        Mock.Of<IEmailService>(),
        Mock.Of<ISubscriptionService>(),
        Mock.Of<INotificationSettingRepository>(),
        mfa,
        Mock.Of<IPasswordResetService>(),
        Mock.Of<ILogger<UserController>>());
}
