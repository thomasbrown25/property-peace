using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Repositories.Notifications;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PushNotifications;
using brownstone_hub_api.Services.SmsService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Notifications;

public sealed class ExpoPushDispatchTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DispatchesOnlyForPersistedInAppAlert_AndProviderFailureDoesNotFailCreation(bool sendInApp)
    {
        var repository = new Mock<INotificationRepository>();
        repository.Setup(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()))
            .ReturnsAsync(new NotificationDto { Id = 42 });
        var sender = new Mock<IExpoPushSender>();
        sender.Setup(x => x.SendAsync(7, 42)).ThrowsAsync(new HttpRequestException("Expo offline"));
        var service = new NotificationService(repository.Object, Mock.Of<INotificationSettingRepository>(),
            Mock.Of<IHubContext<NotificationHub>>(), Mock.Of<IEmailService>(), Mock.Of<ISmsService>(),
            new SmsTemplateService(Mock.Of<ILogger<SmsTemplateService>>()),
            new EmailTemplateService(Mock.Of<ILogger<EmailTemplateService>>()), Mock.Of<IUserRepository>(),
            Mock.Of<IHttpContextAccessor>(), Mock.Of<ILogger<NotificationService>>(), pushSender: sender.Object);

        var result = await service.CreateNotification(new CreateNotificationDto { UserId = 7, SendInApp = sendInApp });

        result.Success.Should().BeTrue();
        repository.Verify(x => x.CreateNotification(It.IsAny<CreateNotificationDto>()), sendInApp ? Times.Once() : Times.Never());
        sender.Verify(x => x.SendAsync(7, 42), sendInApp ? Times.Once() : Times.Never());
    }
}
