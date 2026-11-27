using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Admin;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Email;

public sealed class MarketingBroadcastUnsubscribeTests
{
    [Fact]
    public async Task UnsubscribeAsync_OptOutAppliesToNormalizedEmailAddressAndIsIdempotent()
    {
        await using var context = CreateContext();
        var service = CreateService(context);
        var url = service.BuildUnsubscribeUrl("  Interested@Example.com  ");

        (await service.IsUnsubscribedAsync("interested@example.com")).Should().BeFalse();

        var token = new Uri(url).Fragment.TrimStart('#');
        (await service.UnsubscribeAsync(token)).Should().BeTrue();
        (await service.UnsubscribeAsync(token)).Should().BeTrue();

        (await service.IsUnsubscribedAsync("INTERESTED@example.com")).Should().BeTrue();
        (await context.Set<brownstone_hub_api.Models.MarketingEmailOptOut>().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task BuildUnsubscribeUrl_UsesTrustedConfiguredOriginAndDoesNotExposeRecipientAddress()
    {
        await using var context = CreateContext();
        var service = CreateService(context, "https://email.example.test");

        var url = service.BuildUnsubscribeUrl("recipient@example.com", "untrusted.example.test");
        var uri = new Uri(url);

        uri.GetLeftPart(UriPartial.Path).Should().Be("https://email.example.test/api/email/unsubscribe");
        uri.Fragment.Should().NotBeEmpty();
        url.Should().NotContain("recipient@example.com");
        url.Should().NotContain("untrusted.example.test");
    }

    [Fact]
    public async Task UnsubscribeAsync_RejectsInvalidTokenWithoutCreatingAnOptOut()
    {
        await using var context = CreateContext();
        var service = CreateService(context);

        (await service.UnsubscribeAsync("not-a-valid-protected-token")).Should().BeFalse();
        (await context.Set<brownstone_hub_api.Models.MarketingEmailOptOut>().AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Confirm_DoesNotUnsubscribeUntilTheFormIsPosted()
    {
        await using var context = CreateContext();
        var service = CreateService(context);
        var controller = CreateController(service);

        var response = Assert.IsType<ContentResult>(controller.Confirm());

        response.Content.Should().Contain("Confirm to stop receiving Property Peace marketing emails.");
        response.Content.Should().Contain("method=\"post\"");
        (await service.IsUnsubscribedAsync("recipient@example.com")).Should().BeFalse();
    }

    [Fact]
    public async Task Unsubscribe_PostedValidTokenPersistsOptOutAndReturnsConfirmation()
    {
        await using var context = CreateContext();
        var service = CreateService(context);
        var token = new Uri(service.BuildUnsubscribeUrl("recipient@example.com")).Fragment.TrimStart('#');
        var controller = CreateController(service);

        var response = Assert.IsType<ContentResult>(await controller.Unsubscribe(token, CancellationToken.None));

        response.StatusCode.Should().Be(StatusCodes.Status200OK);
        response.Content.Should().Contain("You’re unsubscribed");
        (await service.IsUnsubscribedAsync("recipient@example.com")).Should().BeTrue();
    }

    [Fact]
    public async Task SendBroadcastEmail_MarketingSkipsOptedOutAddressesAndAddsMatchingHtmlAndPlainTextLinks()
    {
        await using var context = CreateContext();
        var unsubscribe = CreateService(context);
        var optedOutToken = new Uri(unsubscribe.BuildUnsubscribeUrl("opted-out@example.com")).Fragment.TrimStart('#');
        (await unsubscribe.UnsubscribeAsync(optedOutToken)).Should().BeTrue();
        var users = CreateUsers(
            new LoadUserDto { Id = 1, Firstname = "Opted", Email = "opted-out@example.com" },
            new LoadUserDto { Id = 2, Firstname = "Eligible", Email = "eligible@example.com" });
        var email = new Mock<IEmailService>(MockBehavior.Strict);
        string? html = null;
        string? text = null;
        email.Setup(service => service.SendEmailAsync(
                "eligible@example.com", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, CancellationToken>((_, _, htmlContent, plainText, _) =>
            {
                html = htmlContent;
                text = plainText;
            })
            .ReturnsAsync(true);
        var controller = CreateBroadcastController(users.Object, email.Object, unsubscribe);

        var result = Assert.IsType<OkObjectResult>(await controller.SendBroadcastEmail(new AdminBroadcastEmailRequestDto
        {
            Subject = "Hello {{FirstName}}",
            Body = "A marketing update.",
            IsMarketing = true,
            UserIds = [1, 2]
        }));

        GetResponseProperty<int>(result.Value!, "sentCount").Should().Be(1);
        GetResponseProperty<int>(result.Value!, "skippedUnsubscribedCount").Should().Be(1);
        GetResponseProperty<List<long>>(result.Value!, "submittedUserIds").Should().Equal(2);
        html.Should().Contain("Unsubscribe from marketing emails");
        text.Should().Contain("Unsubscribe from marketing emails");
        var unsubscribeUrl = ExtractUnsubscribeUrl(text!);
        html.Should().Contain(unsubscribeUrl);
        unsubscribeUrl.Should().NotContain("eligible@example.com");
        email.VerifyAll();
    }

    [Fact]
    public async Task SendBroadcastEmail_OperationalNoticeIgnoresMarketingOptOutAndOmitsUnsubscribeLink()
    {
        await using var context = CreateContext();
        var unsubscribe = CreateService(context);
        var optedOutToken = new Uri(unsubscribe.BuildUnsubscribeUrl("opted-out@example.com")).Fragment.TrimStart('#');
        (await unsubscribe.UnsubscribeAsync(optedOutToken)).Should().BeTrue();
        var users = CreateUsers(new LoadUserDto { Id = 1, Firstname = "Opted", Email = "opted-out@example.com" });
        var email = new Mock<IEmailService>(MockBehavior.Strict);
        string? html = null;
        string? text = null;
        email.Setup(service => service.SendEmailAsync(
                "opted-out@example.com", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, CancellationToken>((_, _, htmlContent, plainText, _) =>
            {
                html = htmlContent;
                text = plainText;
            })
            .ReturnsAsync(true);
        var controller = CreateBroadcastController(users.Object, email.Object, unsubscribe);

        var result = Assert.IsType<OkObjectResult>(await controller.SendBroadcastEmail(new AdminBroadcastEmailRequestDto
        {
            Subject = "Scheduled maintenance",
            Body = "The service is unavailable tonight.",
            IsMarketing = false
        }));

        GetResponseProperty<int>(result.Value!, "sentCount").Should().Be(1);
        GetResponseProperty<int>(result.Value!, "skippedUnsubscribedCount").Should().Be(0);
        html.Should().NotContain("Unsubscribe from marketing emails");
        text.Should().NotContain("Unsubscribe from marketing emails");
        email.VerifyAll();
    }

    private static DataContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new DataContext(options);
    }

    private static MarketingEmailUnsubscribeService CreateService(DataContext context, string? publicApiBaseUrl = null)
    {
        var settings = new Dictionary<string, string?>();
        if (publicApiBaseUrl is not null)
        {
            settings["MarketingEmail:PublicApiBaseUrl"] = publicApiBaseUrl;
        }

        return new MarketingEmailUnsubscribeService(
            context,
            new EphemeralDataProtectionProvider(),
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),
            TimeProvider.System);
    }

    private static MarketingEmailUnsubscribeController CreateController(MarketingEmailUnsubscribeService service) =>
        new(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

    private static Mock<IUserService> CreateUsers(params LoadUserDto[] users)
    {
        var service = new Mock<IUserService>(MockBehavior.Strict);
        service.Setup(candidate => candidate.GetAllUsers(false))
            .ReturnsAsync(ServiceResponse<List<LoadUserDto>>.CreateSuccess([.. users]));
        return service;
    }

    private static AdminBroadcastEmailController CreateBroadcastController(
        IUserService users,
        IEmailService email,
        MarketingEmailUnsubscribeService unsubscribe) =>
        new(users, email, Mock.Of<IOpenAIService>(), unsubscribe, NullLogger<AdminBroadcastEmailController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

    private static T GetResponseProperty<T>(object response, string name) =>
        Assert.IsType<T>(response.GetType().GetProperty(name)?.GetValue(response));

    private static string ExtractUnsubscribeUrl(string plainText) =>
        plainText.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Single(value => value.StartsWith("https://", StringComparison.Ordinal) &&
                             value.Contains("/api/email/unsubscribe#", StringComparison.Ordinal));
}
