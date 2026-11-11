using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeDirectChargeReadinessTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 12, 0, 0, TimeSpan.Zero);
    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => Now; }
    private static StripeConnectedAccountSnapshot Ready => new(
        "acct_standard", Now, true, true, false, null, [], [], null, "bank_fingerprint",
        "daily", true, true, CardPaymentsCapabilityStatus: "active",
        DashboardType: "full", LossesPayments: "stripe", FeesPayer: "account");

    [Theory]
    [InlineData("daily")]
    [InlineData("weekly")]
    [InlineData("monthly")]
    [InlineData("manual")]
    public void StripeManagedPayouts_DoNotRequireTransfersOrPlatformPayoutControl(string interval)
    {
        StripeConnectedPayeeService.RestrictionReason(Ready with { PayoutSchedulePolicy = interval }).Should().BeNull();
        StripeConnectedPayeeService.RestrictionReason(Ready with { PayoutSchedulePolicy = interval }, true).Should().BeNull();
    }

    public static TheoryData<StripeConnectedAccountSnapshot, string> InvalidStates => new()
    {
        { Ready with { DetailsSubmitted = false }, "details" },
        { Ready with { PayoutsEnabled = false }, "payouts are disabled" },
        { Ready with { ChargesEnabled = false }, "charges are disabled" },
        { Ready with { CardPaymentsCapabilityStatus = "pending" }, "card payments capability" },
        { Ready with { CardPaymentsCapabilityStatus = null }, "card payments capability" },
        { Ready with { CurrentlyDue = ["business_profile.url"] }, "currently-due" },
        { Ready with { PastDue = ["individual.verification"] }, "past-due" },
        { Ready with { DisabledReason = "rejected.fraud" }, "disabled the account" },
        { Ready with { ExternalAccountFingerprint = null }, "payout destination" },
        { Ready with { PayoutSchedulePolicy = null }, "schedule is invalid" },
        { Ready with { PayoutSchedulePolicy = "unknown" }, "schedule is invalid" },
        { Ready with { LossesPayments = "application" }, "controller configuration" },
        { Ready with { FeesPayer = "application" }, "controller configuration" },
        { Ready with { DashboardType = "express" }, "controller configuration" }
    };

    [Theory]
    [MemberData(nameof(InvalidStates))]
    public void DirectCharge_BlocksInvalidStates(StripeConnectedAccountSnapshot snapshot, string reason) =>
        StripeConnectedPayeeService.RestrictionReason(snapshot, true).Should().Contain(reason);

    [Fact]
    public void LegacyTransfers_StillRequireActiveTransfersAndManualSchedule()
    {
        StripeConnectedPayeeService.RestrictionReason(Ready, false).Should().Contain("transfer capability");
        var legacy = Ready with { TransfersActive = true, TransferCapabilityStatus = "active" };
        StripeConnectedPayeeService.RestrictionReason(legacy, false).Should().Contain("not manual");
        StripeConnectedPayeeService.RestrictionReason(legacy with { PayoutSchedulePolicy = "manual" }, false).Should().BeNull();
    }

    [Fact]
    public void Snapshot_MapsControllerAndCardPaymentsFromStripeAccount()
    {
        var account = new Stripe.Account
        {
            Id = "acct_standard", DetailsSubmitted = true, ChargesEnabled = true, PayoutsEnabled = true,
            Capabilities = new AccountCapabilities { CardPayments = "active" },
            Controller = new AccountController
            {
                StripeDashboard = new AccountControllerStripeDashboard { Type = "full" },
                Losses = new AccountControllerLosses { Payments = "stripe" },
                Fees = new AccountControllerFees { Payer = "account" }
            },
            Settings = new AccountSettings { Payouts = new AccountSettingsPayouts { Schedule = new AccountSettingsPayoutsSchedule { Interval = "daily" } } }
        };
        var snapshot = StripeConnectedAccountGateway.FromAccount(account, Now,
            new IExternalAccount[] { new Stripe.BankAccount { Id = "ba_test", Fingerprint = "fp", Currency = "usd", DefaultForCurrency = true } });
        snapshot.IsStripeManagedDirectCharge.Should().BeTrue();
        snapshot.CardPaymentsCapabilityStatus.Should().Be("active");
        snapshot.TransfersActive.Should().BeFalse();
        StripeConnectedPayeeService.RestrictionReason(snapshot).Should().BeNull();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RiskGate_AutomaticPayoutsAreReady_AndStripeReadinessHoldsRecover(bool previouslyRestricted)
    {
        await using var context = StripeRentPaymentFlowTests.CreateContext();
        context.Users.Add(new User { Id = 42, Email = "standard@example.test", StripeAccountId = Ready.StripeAccountId });
        context.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 7, UserId = 42, Role = "Owner", IsActive = true });
        context.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            UserId = 42, StripeAccountId = Ready.StripeAccountId, CreatedAt = Now.AddDays(-100), UpdatedAt = Now,
            Status = previouslyRestricted ? StripePayeeReviewStatus.Suspended : StripePayeeReviewStatus.StripeVerified,
            SuspendedAt = previouslyRestricted ? Now.AddMinutes(-1) : null,
            SuspensionReason = previouslyRestricted ? "Stripe charges are disabled." : null,
            PayoutSchedulePolicy = "daily"
        });
        await context.SaveChangesAsync();
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync(Ready.StripeAccountId, It.IsAny<CancellationToken>())).ReturnsAsync(Ready);
        var service = new StripeRentRiskService(context, gateway.Object, new ConfigurationBuilder().Build(), new Clock());
        var payment = new StripeRentPayment
        {
            OrganizationId = 7, DestinationStripeAccountId = Ready.StripeAccountId,
            ChargeStripeAccountId = Ready.StripeAccountId, AmountCents = 10000
        };
        var decision = await service.EvaluatePayeeAsync(payment);
        decision.Approved.Should().BeTrue(decision.Reason);
        context.Users.Single().StripeAccountEnabled.Should().BeTrue();
        context.StripeConnectedPayeeReviews.Single().PayoutSchedulePolicy.Should().Be("daily");
        context.StripeConnectedPayeeReviews.Single().InstantPayoutsAllowed.Should().BeFalse();

        gateway.Setup(x => x.GetSnapshotAsync(Ready.StripeAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Ready with { ChargesEnabled = false });
        (await service.EvaluatePayeeAsync(payment)).Approved.Should().BeFalse();
        context.Users.Single().StripeAccountEnabled.Should().BeFalse();

        gateway.Setup(x => x.GetSnapshotAsync(Ready.StripeAccountId, It.IsAny<CancellationToken>())).ReturnsAsync(Ready);
        (await service.EvaluatePayeeAsync(payment)).Approved.Should().BeTrue();
        payment.ChargeStripeAccountId = "acct_wrong";
        (await service.EvaluatePayeeAsync(payment)).Reason.Should().Contain("does not match");
    }
}
