using System.Collections.Concurrent;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.NotificationSettings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentPaymentAccess;

public sealed class RentPaymentAccessNotificationServiceTests
{
    private static readonly Guid PublicId = Guid.Parse("38d406ae-e3ea-4b7f-a5bc-9964eff631a8");
    private static readonly DateTime RequestedAtUtc = new(2031, 4, 5, 14, 30, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Routes_to_enabled_admins_using_the_new_user_notification_email_resolution_path()
    {
        var admins = new List<User>
        {
            new() { Id = 11, FirstName = "Existing", LastName = "Admin", Email = "account-one@example.test" },
            new() { Id = 12, FirstName = "Disabled", LastName = "Admin", Email = "disabled@example.test" },
            new() { Id = 13, FirstName = "Default", LastName = "Admin", Email = "account-three@example.test" }
        };
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetAdminUsersAsync()).ReturnsAsync(admins);
        var settings = new Mock<INotificationSettingRepository>();
        settings.Setup(repository => repository.GetNotificationSettings(11))
            .ReturnsAsync(EnabledSettings(11, "review-queue@example.test"));
        settings.Setup(repository => repository.GetNotificationSettings(12))
            .ReturnsAsync(DisabledSettings(12, "disabled@example.test"));
        settings.Setup(repository => repository.GetNotificationSettings(13))
            .ReturnsAsync((NotificationSettingDto?)null);
        settings.Setup(repository => repository.AddNotificationSettings(13))
            .ReturnsAsync(EnabledSettings(13, null));
        settings.Setup(repository => repository.UpdateNotificationSettings(
                It.Is<NotificationSettingDto>(value => value.UserId == 13 &&
                                                        value.EmailAddress == "account-three@example.test")))
            .ReturnsAsync((NotificationSettingDto value) => value);
        var email = new RecordingEmailService();
        var service = CreateService(users.Object, settings.Object, email);

        var result = await service.NotifyReviewersAsync(Request(), CancellationToken.None);

        result.Should().Be(new RentPaymentAccessNotificationResult(2, 2, 0));
        email.Messages.Select(message => message.To).Should()
            .BeEquivalentTo("review-queue@example.test", "account-three@example.test");
        users.Verify(repository => repository.GetAdminUsersAsync(), Times.Once);
        settings.Verify(repository => repository.GetNotificationSettings(It.IsAny<long>()), Times.Exactly(3));
        settings.Verify(repository => repository.AddNotificationSettings(13), Times.Once);
        settings.Verify(repository => repository.UpdateNotificationSettings(It.IsAny<NotificationSettingDto>()),
            Times.Once);
    }

    [Fact]
    public async Task Does_not_send_when_master_email_switch_is_disabled_even_if_admin_preference_is_enabled()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetAdminUsersAsync()).ReturnsAsync(
            [new User { Id = 14, FirstName = "Opted", LastName = "Out", Email = "admin@example.test" }]);
        var notificationSettings = EnabledSettings(14, "admin@example.test");
        notificationSettings.EmailEnabled = false;
        var settings = new Mock<INotificationSettingRepository>();
        settings.Setup(repository => repository.GetNotificationSettings(14))
            .ReturnsAsync(notificationSettings);
        var email = new RecordingEmailService();
        var service = CreateService(users.Object, settings.Object, email);

        var result = await service.NotifyReviewersAsync(Request(), CancellationToken.None);

        result.Should().Be(new RentPaymentAccessNotificationResult(0, 0, 0));
        email.Messages.Should().BeEmpty();
    }

    [Fact]
    public async Task Builds_a_scanner_safe_review_message_with_a_stable_transition_idempotency_token()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetAdminUsersAsync()).ReturnsAsync(
            [new User { Id = 21, FirstName = "Review", LastName = "Admin", Email = "admin@example.test" }]);
        var settings = new Mock<INotificationSettingRepository>();
        settings.Setup(repository => repository.GetNotificationSettings(21))
            .ReturnsAsync(EnabledSettings(21, "rent-review@example.test"));
        var email = new RecordingEmailService();
        var service = CreateService(users.Object, settings.Object, email, "https://console.example.test/root/");

        await service.NotifyReviewersAsync(Request(), CancellationToken.None);

        var message = email.Messages.Should().ContainSingle().Subject;
        message.Subject.Should().Be("Online rent collection request");
        message.Html.Should().Contain("Pine &amp; Oak Property Group")
            .And.Contain("Avery &lt;Landlord&gt;")
            .And.Contain("2031-04-05 14:30:00 UTC")
            .And.Contain("https://console.example.test/root/admin/rent-payment-access/38d406ae-e3ea-4b7f-a5bc-9964eff631a8")
            .And.Contain("Review rent-payment request")
            .And.NotContain("approval-token")
            .And.NotContain("Bank account 9999")
            .And.NotContain("approve?");
        message.Text.Should().Contain("Pine & Oak Property Group")
            .And.Contain("Avery <Landlord>")
            .And.Contain("2031-04-05 14:30:00 UTC")
            .And.EndWith("https://console.example.test/root/admin/rent-payment-access/38d406ae-e3ea-4b7f-a5bc-9964eff631a8");
        message.IdempotencyToken.Should()
            .Be($"rent-payment-access:{PublicId}:pending:{RequestedAtUtc.Ticks}");
        Uri.TryCreate(message.ReviewUrl, UriKind.Absolute, out var reviewUri).Should().BeTrue();
        reviewUri!.AbsolutePath.Should()
            .EndWith($"/admin/rent-payment-access/{PublicId}");
        reviewUri.Query.Should().BeEmpty();
    }

    [Theory]
    [InlineData("http://console.example.test/root/", "http://console.example.test/root/admin/rent-payment-access/38d406ae-e3ea-4b7f-a5bc-9964eff631a8")]
    [InlineData("https://console.example.test/root///", "https://console.example.test/root/admin/rent-payment-access/38d406ae-e3ea-4b7f-a5bc-9964eff631a8")]
    public async Task Accepts_absolute_http_or_https_base_urls_and_normalizes_the_review_route(
        string frontendBaseUrl,
        string expectedReviewUrl)
    {
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetAdminUsersAsync()).ReturnsAsync(
            [new User { Id = 22, FirstName = "Review", LastName = "Admin", Email = "admin@example.test" }]);
        var settings = new Mock<INotificationSettingRepository>();
        settings.Setup(repository => repository.GetNotificationSettings(22))
            .ReturnsAsync(EnabledSettings(22, "rent-review@example.test"));
        var email = new RecordingEmailService();
        var service = CreateService(users.Object, settings.Object, email, frontendBaseUrl);

        await service.NotifyReviewersAsync(Request(), CancellationToken.None);

        email.Messages.Should().ContainSingle().Subject.ReviewUrl.Should().Be(expectedReviewUrl);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-absolute-url")]
    [InlineData("ftp://console.example.test/root")]
    [InlineData("https://console.example.test/root?theme=dark")]
    [InlineData("https://console.example.test/root#review")]
    public void Rejects_blank_malformed_non_http_query_or_fragment_base_urls(string frontendBaseUrl)
    {
        var act = () => CreateService(
            Mock.Of<IUserRepository>(),
            Mock.Of<INotificationSettingRepository>(),
            new RecordingEmailService(),
            frontendBaseUrl);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*FrontendBaseUrl*");
    }

    [Fact]
    public async Task Continues_after_one_recipient_failure_and_returns_delivery_counts()
    {
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetAdminUsersAsync()).ReturnsAsync(
        [
            new User { Id = 31, FirstName = "One", LastName = "Admin", Email = "one@example.test" },
            new User { Id = 32, FirstName = "Two", LastName = "Admin", Email = "two@example.test" },
            new User { Id = 33, FirstName = "Three", LastName = "Admin", Email = "three@example.test" }
        ]);
        var settings = new Mock<INotificationSettingRepository>();
        foreach (var id in new long[] { 31, 32, 33 })
            settings.Setup(repository => repository.GetNotificationSettings(id))
                .ReturnsAsync(EnabledSettings(id, $"admin-{id}@example.test"));
        var email = new RecordingEmailService
        {
            Outcomes = { ["admin-31@example.test"] = false, ["admin-32@example.test"] = new InvalidOperationException("provider body") }
        };
        var service = CreateService(users.Object, settings.Object, email);

        var result = await service.NotifyReviewersAsync(Request(), CancellationToken.None);

        result.Should().Be(new RentPaymentAccessNotificationResult(3, 1, 2));
        email.Messages.Select(message => message.To).Should().Equal(
            "admin-31@example.test", "admin-32@example.test", "admin-33@example.test");
    }

    private static RentPaymentAccessNotificationService CreateService(
        IUserRepository users,
        INotificationSettingRepository settings,
        IEmailService email,
        string frontendBaseUrl = "https://app.example.test/")
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["FrontendBaseUrl"] = frontendBaseUrl })
            .Build();
        return new RentPaymentAccessNotificationService(
            users, settings, email, configuration, NullLogger<RentPaymentAccessNotificationService>.Instance);
    }

    private static NotificationSettingDto EnabledSettings(long userId, string? emailAddress) => new()
    {
        UserId = userId,
        EmailEnabled = true,
        EmailAddress = emailAddress,
        AdminNewUserNotifications = new NotificationPreferenceDto { Email = true, Phone = false, InApp = true }
    };

    private static NotificationSettingDto DisabledSettings(long userId, string emailAddress) => new()
    {
        UserId = userId,
        EmailEnabled = true,
        EmailAddress = emailAddress,
        AdminNewUserNotifications = new NotificationPreferenceDto { Email = false, Phone = true, InApp = true }
    };

    private static RentPaymentAccessAdminDetailDto Request() => new(
        PublicId,
        701,
        "Pine & Oak Property Group",
        "Pending",
        41,
        "Avery <Landlord>",
        RequestedAtUtc,
        null,
        null,
        "approval-token",
        "Bank account 9999",
        [1, 2, 3],
        []);

    private sealed class RecordingEmailService : IEmailService
    {
        public ConcurrentQueue<Message> Messages { get; } = new();
        public Dictionary<string, object> Outcomes { get; } = [];

        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) =>
            Task.FromResult(true);

        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent,
            string? senderAddress, CancellationToken cancellationToken = default) => Task.FromResult(true);

        public Task<EmailSubmissionResult> SubmitEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent = null, string? senderAddress = null,
            CancellationToken cancellationToken = default, string? idempotencyToken = null)
        {
            var reviewUrl = ExtractReviewUrl(plainTextContent ?? string.Empty);
            Messages.Enqueue(new Message(to, subject, htmlContent, plainTextContent ?? string.Empty,
                idempotencyToken, reviewUrl));
            if (Outcomes.TryGetValue(to, out var outcome))
            {
                if (outcome is Exception exception) throw exception;
                return Task.FromResult(new EmailSubmissionResult((bool)outcome, "test", null));
            }
            return Task.FromResult(new EmailSubmissionResult(true, "test", "message-id"));
        }

        public Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Task.FromResult(true);

        private static string ExtractReviewUrl(string text) =>
            text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Single(line => line.StartsWith("http://", StringComparison.Ordinal) ||
                                line.StartsWith("https://", StringComparison.Ordinal));
    }

    private sealed record Message(
        string To,
        string Subject,
        string Html,
        string Text,
        string? IdempotencyToken,
        string ReviewUrl);
}
