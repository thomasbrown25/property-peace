using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using brownstone_hub_api.Services.OrganizationSmsNumberService;
using Microsoft.AspNetCore.Http;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.OrganizationSmsNumbers;

public sealed class OrganizationSmsNumberRefreshEntitlementTests
{
    private const string StableDenialMessage =
        "Dedicated SMS numbers are included with eligible Premium and Lifetime organizations.";

    private readonly Mock<IOrganizationSmsNumberRepository> _numbers = new();
    private readonly Mock<IEntitlementDecisionService> _decisions = new();
    private readonly Mock<ITwilioPhoneNumberService> _twilio = new();

    [Theory]
    [InlineData(EntitlementOutcome.Denied)]
    [InlineData(EntitlementOutcome.Exception)]
    [InlineData(EntitlementOutcome.Cancelled)]
    public async Task Refresh_fails_closed_with_stable_denial_and_never_calls_Twilio(
        EntitlementOutcome outcome)
    {
        ConfigureDecision(outcome);

        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => Service().RefreshStatusAsync(7, CancellationToken.None));

        Assert.Equal(StableDenialMessage, exception.Message);
        _twilio.VerifyNoOtherCalls();
        _numbers.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Refresh_with_allowed_entitlement_preserves_provider_refresh_and_status_update()
    {
        _decisions
            .Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(isAllowed: true));
        var number = new OrganizationSmsNumber
        {
            Id = 7,
            OrganizationId = 20,
            TwilioPhoneNumberSid = "PN123",
            PhoneNumber = "+15551234567",
            Status = "Active",
            IsActive = true,
            IsPrimary = true
        };
        _numbers.Setup(x => x.GetActivePrimaryAsync(20)).ReturnsAsync(number);
        _numbers.Setup(x => x.UpdateAsync(number)).ReturnsAsync(number);
        _twilio
            .Setup(x => x.GetPhoneNumberStatusAsync("PN123", It.IsAny<CancellationToken>()))
            .ReturnsAsync("Suspended");

        var result = await Service().RefreshStatusAsync(7);

        Assert.True(result.HasPremiumAccess);
        Assert.Equal("Suspended", result.Status);
        _twilio.Verify(
            x => x.GetPhoneNumberStatusAsync("PN123", It.IsAny<CancellationToken>()),
            Times.Once);
        _numbers.Verify(x => x.UpdateAsync(number), Times.Once);
    }

    private void ConfigureDecision(EntitlementOutcome outcome)
    {
        var setup = _decisions.Setup(
            x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()));

        switch (outcome)
        {
            case EntitlementOutcome.Denied:
                setup.ReturnsAsync(Decision(isAllowed: false));
                break;
            case EntitlementOutcome.Exception:
                setup.ThrowsAsync(new InvalidOperationException("entitlement provider unavailable"));
                break;
            case EntitlementOutcome.Cancelled:
                setup.ThrowsAsync(new TaskCanceledException("entitlement decision cancelled"));
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(outcome), outcome, null);
        }
    }

    private OrganizationSmsNumberService Service()
    {
        var context = new DefaultHttpContext();
        context.Items["UserId"] = 42L;
        context.Items["OrganizationId"] = 20L;

        return new OrganizationSmsNumberService(
            _numbers.Object,
            new HttpContextAccessor { HttpContext = context },
            _decisions.Object,
            _twilio.Object);
    }

    private static UnifiedEntitlementDecision Decision(bool isAllowed) => new(
        isAllowed,
        isAllowed ? EntitlementDecisionCategory.Allowed : EntitlementDecisionCategory.Upgrade,
        "test",
        FeatureKeys.DedicatedSmsNumberSetup,
        isAllowed ? PlanKeys.Premium : PlanKeys.Free,
        isAllowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.UpgradeRequired);

    public enum EntitlementOutcome
    {
        Denied,
        Exception,
        Cancelled
    }
}
