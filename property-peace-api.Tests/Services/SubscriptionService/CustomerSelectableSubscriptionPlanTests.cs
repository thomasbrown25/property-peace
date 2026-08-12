using AutoMapper;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public sealed class CustomerSelectableSubscriptionPlanTests
{
    private const long LifetimePlanId = 731;

    [Theory]
    [InlineData("Free", true)]
    [InlineData(" free ", true)]
    [InlineData("PREMIUM", true)]
    [InlineData("Lifetime Plan", false)]
    [InlineData("lIfEtImE pLaN", false)]
    [InlineData("Lifetime", false)]
    [InlineData("Starter", false)]
    [InlineData("", false)]
    public void Predicate_AllowsOnlyStablePublicPlanNames(string name, bool expected)
    {
        CustomerSelectableSubscriptionPlan.IsSelectable(new SubscriptionPlan
        {
            Id = LifetimePlanId,
            Name = name,
            MonthlyPrice = 0,
            AnnualPrice = 0,
            StripePriceIdMonthly = "price_future_monthly",
            StripePriceIdAnnual = "price_future_annual"
        }).Should().Be(expected);
    }

    [Fact]
    public void Predicate_RejectsTrialFlagEvenForPublicPlanName()
    {
        CustomerSelectableSubscriptionPlan.IsSelectable(new SubscriptionPlan
        {
            Id = 900,
            Name = "Premium",
            IsActive = true,
            IsTrial = true
        }).Should().BeFalse();
    }

    [Fact]
    public async Task GetAvailablePlansAsync_ExposesOnlyFreeAndPremium()
    {
        var fixture = new Fixture();

        var result = await fixture.Service.GetAvailablePlansAsync();

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Select(plan => plan.Name).Should().Equal("Free", "Premium");
    }

    [Fact]
    public async Task SubscribeAsync_RejectsLifetimeSelectedById()
    {
        var fixture = new Fixture();

        var result = await fixture.Service.SubscribeAsync(new CreateSubscriptionDto { PlanId = LifetimePlanId });

        AssertRejectedWithoutMutation(result, fixture);
    }

    [Fact]
    public async Task CreateCheckoutSessionAsync_RejectsLifetimeSelectedById()
    {
        var fixture = new Fixture();

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = LifetimePlanId,
            BillingCycle = "Monthly"
        });

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        result.Message.Should().Contain("not available", Exactly.Once());
        fixture.AssertNoMutation();
    }

    [Fact]
    public async Task UpgradeSubscriptionAsync_RejectsLifetimeSelectedById()
    {
        var fixture = new Fixture(withExistingSubscription: true);

        var result = await fixture.Service.UpgradeSubscriptionAsync(new UpdateSubscriptionDto { NewPlanId = LifetimePlanId });

        AssertRejectedWithoutMutation(result, fixture);
    }

    [Fact]
    public async Task DowngradeSubscriptionAsync_RejectsLifetimeSelectedById()
    {
        var fixture = new Fixture(withExistingSubscription: true);

        var result = await fixture.Service.DowngradeSubscriptionAsync(new UpdateSubscriptionDto { NewPlanId = LifetimePlanId });

        AssertRejectedWithoutMutation(result, fixture);
    }

    public static TheoryData<string, bool> NonSelectablePublicPlans => new()
    {
        { "Free", false },
        { "Premium", false },
        { "Future Internal", true },
    };

    [Theory]
    [MemberData(nameof(NonSelectablePublicPlans))]
    public async Task SubscribeAsync_RejectsInactiveOrUnknownPlan(string name, bool isActive)
    {
        var fixture = new Fixture(selectedPlan: new SubscriptionPlan { Id = 812, Name = name, IsActive = isActive });

        var result = await fixture.Service.SubscribeAsync(new CreateSubscriptionDto { PlanId = 812 });

        AssertRejectedWithoutMutation(result, fixture);
    }

    [Theory]
    [MemberData(nameof(NonSelectablePublicPlans))]
    public async Task Checkout_RejectsInactiveOrUnknownPlan(string name, bool isActive)
    {
        var fixture = new Fixture(selectedPlan: new SubscriptionPlan { Id = 812, Name = name, IsActive = isActive });

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = 812,
            BillingCycle = "Monthly"
        });

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        result.Message.Should().Contain("not available", Exactly.Once());
        fixture.AssertNoMutation();
    }

    [Theory]
    [MemberData(nameof(NonSelectablePublicPlans))]
    public async Task Upgrade_RejectsInactiveOrUnknownPlan(string name, bool isActive)
    {
        var fixture = new Fixture(
            withExistingSubscription: true,
            selectedPlan: new SubscriptionPlan { Id = 812, Name = name, IsActive = isActive });

        var result = await fixture.Service.UpgradeSubscriptionAsync(new UpdateSubscriptionDto { NewPlanId = 812 });

        AssertRejectedWithoutMutation(result, fixture);
    }

    [Theory]
    [MemberData(nameof(NonSelectablePublicPlans))]
    public async Task Downgrade_RejectsInactiveOrUnknownPlan(string name, bool isActive)
    {
        var fixture = new Fixture(
            withExistingSubscription: true,
            selectedPlan: new SubscriptionPlan { Id = 812, Name = name, IsActive = isActive });

        var result = await fixture.Service.DowngradeSubscriptionAsync(new UpdateSubscriptionDto { NewPlanId = 812 });

        AssertRejectedWithoutMutation(result, fixture);
    }

    [Fact]
    public async Task TrialEligibility_IsAlwaysFalseWithoutReadingPersistence()
    {
        var fixture = new Fixture();

        var result = await fixture.Service.CheckTrialEligibilityAsync();

        result.Success.Should().BeTrue();
        result.Data.Should().BeFalse();
        result.Message.Should().Be("Trials are no longer available.");
        fixture.AssertTrialDidNotReadPlanOrSubscriptionState();
    }

    [Fact]
    public async Task StartTrialAsync_IsRetiredWithoutReadingOrMutatingPersistenceOrStripe()
    {
        var fixture = new Fixture();

        var result = await fixture.Service.StartTrialAsync();

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(StatusCodes.Status410Gone);
        result.Message.Should().Be("Trials are no longer available.");
        fixture.AssertNoMutation();
        fixture.AssertTrialDidNotReadPlanOrSubscriptionState();
    }

    private static void AssertRejectedWithoutMutation(ServiceResponse<SubscriptionDto> result, Fixture fixture)
    {
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        result.Message.Should().Contain("not available", Exactly.Once());
        fixture.AssertNoMutation();
    }

    private sealed class Fixture
    {
        private readonly Mock<ISubscriptionRepository> _subscriptions = new();
        private readonly Mock<ISubscriptionHistoryRepository> _history = new();
        private readonly Mock<IStripeService> _stripe = new();
        private readonly Mock<ISubscriptionPlanRepository> _plans = new();
        private readonly Mock<IMapper> _mapper = new();

        public Fixture(bool withExistingSubscription = false, SubscriptionPlan? selectedPlan = null)
        {
            var currentUser = new LoadUserDto { Id = 42, Email = "customer@example.test", Roles = ["Tenant"] };
            var users = new Mock<IUserRepository>();
            users.Setup(repository => repository.GetCurrentUser()).ReturnsAsync(currentUser);

            var lifetime = new SubscriptionPlan
            {
                Id = LifetimePlanId,
                Name = "lIfEtImE pLaN",
                MonthlyPrice = 0,
                AnnualPrice = 0,
                StripePriceIdMonthly = "price_future_monthly",
                StripePriceIdAnnual = "price_future_annual",
                IsActive = true
            };
            _plans.Setup(repository => repository.GetPlanByIdAsync(LifetimePlanId)).ReturnsAsync(lifetime);
            if (selectedPlan != null)
            {
                _plans.Setup(repository => repository.GetPlanByIdAsync(selectedPlan.Id)).ReturnsAsync(selectedPlan);
            }
            _plans.Setup(repository => repository.GetAllPlansAsync()).ReturnsAsync([
                new SubscriptionPlan { Id = 1, Name = "Free", IsActive = true },
                new SubscriptionPlan { Id = 2, Name = "Premium", IsActive = true },
                lifetime,
                new SubscriptionPlan { Id = 4, Name = "Future Internal", IsActive = true }
            ]);
            _mapper.Setup(mapper => mapper.Map<SubscriptionPlanDto>(It.IsAny<SubscriptionPlan>()))
                .Returns((SubscriptionPlan plan) => new SubscriptionPlanDto { Id = plan.Id, Name = plan.Name });

            Subscription? existing = withExistingSubscription
                ? new Subscription
                {
                    Id = 99,
                    UserId = currentUser.Id,
                    SubscriptionPlanId = 1,
                    SubscriptionPlan = new SubscriptionPlan { Id = 1, Name = "Free" },
                    Status = "Active",
                    BillingCycle = "Monthly"
                }
                : null;
            _subscriptions.Setup(repository => repository.GetSubscriptionByUserIdAsync(currentUser.Id)).ReturnsAsync(existing);

            Service = new brownstone_hub_api.Services.SubscriptionService.SubscriptionService(
                _subscriptions.Object,
                _plans.Object,
                _history.Object,
                users.Object,
                Mock.Of<IOrganizationMemberRepository>(),
                Mock.Of<IOrganizationRepository>(),
                _stripe.Object,
                Mock.Of<IFeatureGateService>(),
                Mock.Of<IEntitlementDecisionService>(),
                new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
                _mapper.Object,
                Mock.Of<ILogger<brownstone_hub_api.Services.SubscriptionService.SubscriptionService>>());
        }

        public brownstone_hub_api.Services.SubscriptionService.SubscriptionService Service { get; }

        public void AssertNoMutation()
        {
            _subscriptions.Verify(repository => repository.CreateSubscriptionAsync(It.IsAny<Subscription>()), Times.Never);
            _subscriptions.Verify(repository => repository.UpdateSubscriptionAsync(It.IsAny<Subscription>()), Times.Never);
            _history.Verify(repository => repository.AddHistoryAsync(It.IsAny<SubscriptionHistory>()), Times.Never);
            _stripe.VerifyNoOtherCalls();
        }

        public void AssertTrialDidNotReadPlanOrSubscriptionState()
        {
            _plans.Verify(repository => repository.GetAllPlansAsync(), Times.Never);
            _plans.Verify(repository => repository.GetPlanByIdAsync(It.IsAny<long>()), Times.Never);
            _subscriptions.Verify(repository => repository.GetSubscriptionByOrganizationIdAsync(It.IsAny<long>()), Times.Never);
            _subscriptions.Verify(repository => repository.GetSubscriptionByUserIdAsync(It.IsAny<long>()), Times.Never);
        }
    }
}
