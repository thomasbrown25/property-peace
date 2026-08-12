using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Hubs;
using brownstone_hub_api.Repositories.Notifications;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Services.Timelines;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Notifications;

public sealed class NotificationDeliveryAtomicityTests
{
    [Fact]
    public async Task LegacyEmail_WithTimelineAudit_CallsProviderExactlyOnce_WithCompletePayload()
    {
        var settingsRepository = new Mock<INotificationSettingRepository>();
        settingsRepository.Setup(x => x.GetNotificationSettings(7)).ReturnsAsync(new NotificationSettingDto
        {
            UserId = 7,
            EmailEnabled = true,
            EmailAddress = "tenant@example.test",
            RentReminders = new NotificationPreferenceDto { Email = true }
        });
        var email = new Mock<IEmailService>();
        email.Setup(x => x.SendEmailAsync("tenant@example.test", It.Is<string>(s => !string.IsNullOrWhiteSpace(s)),
                It.Is<string>(s => !string.IsNullOrWhiteSpace(s)), It.Is<string>(s => !string.IsNullOrWhiteSpace(s)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var timeline = new Mock<IWorkflowTimelineIntegration>();
        var service = new NotificationService(
            Mock.Of<INotificationRepository>(), settingsRepository.Object, Mock.Of<IHubContext<NotificationHub>>(),
            email.Object, Mock.Of<ISmsService>(),
            new SmsTemplateService(Mock.Of<ILogger<SmsTemplateService>>()),
            new EmailTemplateService(Mock.Of<ILogger<EmailTemplateService>>()),
            Mock.Of<IUserRepository>(), Mock.Of<IHttpContextAccessor>(),
            Mock.Of<ILogger<NotificationService>>(), timeline.Object);
        var request = new CreateNotificationDto
        {
            UserId = 7, Type = ENotificationType.Rent, Title = "Unpaid rent",
            Message = "Rent remains unpaid.", SendEmail = true, SendInApp = false,
            OrganizationId = 100, RelatedId = 20
        };

        var result = await service.CreateNotification(request);

        result.Success.Should().BeTrue();
        email.Verify(x => x.SendEmailAsync("tenant@example.test", It.Is<string>(s => s.Length > 0),
            It.Is<string>(s => s.Length > 0), It.Is<string>(s => s.Length > 0),
            It.IsAny<CancellationToken>()), Times.Once);
        email.VerifyNoOtherCalls();
        timeline.Verify(x => x.RecordNotificationAttemptAsync(request, null, "tenant@example.test", null,
            true, false, It.IsAny<CancellationToken>()), Times.Once);
    }
}
