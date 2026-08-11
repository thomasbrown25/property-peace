using AutoMapper;
using brownstone_hub_api.Data;
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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public sealed class CheckoutPackagingContractTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("monthly")]
    [InlineData(" Monthly")]
    [InlineData("Weekly")]
    public async Task Checkout_RejectsNonCanonicalBillingCycleBeforeAnyDependencyCall(string? billingCycle)
    {
        var fixture = new CheckoutFixture();

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = 2,
            BillingCycle = billingCycle!,
        });

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        result.Message.Should().Be("Billing cycle must be either Monthly or Annual.");
        fixture.Users.VerifyNoOtherCalls();
        fixture.Plans.VerifyNoOtherCalls();
        fixture.Subscriptions.VerifyNoOtherCalls();
        fixture.Organizations.VerifyNoOtherCalls();
        fixture.Members.VerifyNoOtherCalls();
        fixture.Stripe.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Checkout_FreePlan_CreatesActiveFiveUnitSubscriptionWithoutStripe()
    {
        var fixture = new CheckoutFixture();
        var free = fixture.AddPlan(new SubscriptionPlan
        {
            Id = 1,
            Name = "Free",
            IsActive = true,
            MaxTotalUnits = 5,
            MonthlyPrice = 0,
            AnnualPrice = 0,
        });

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = free.Id,
            BillingCycle = "Monthly",
            SuccessUrl = "/free-success",
        });

        result.Success.Should().BeTrue();
        result.Data.Should().Be("/free-success");
        free.MaxTotalUnits.Should().Be(5);
        fixture.Subscriptions.Verify(repository => repository.CreateSubscriptionAsync(It.Is<Subscription>(value =>
            value.SubscriptionPlanId == free.Id
            && value.Status == "Active"
            && value.BillingCycle == "Monthly"
            && value.StripeCustomerId == null
            && value.StripeSubscriptionId == null)), Times.Once);
        fixture.Stripe.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("Monthly", "price_monthly")]
    [InlineData("Annual", "price_annual")]
    public async Task Checkout_PremiumPlan_UsesApplicableConfiguredPrice(string billingCycle, string expectedPriceId)
    {
        var fixture = new CheckoutFixture();
        var premium = fixture.AddPlan(new SubscriptionPlan
        {
            Id = 2,
            Name = "Premium",
            IsActive = true,
            MaxTotalUnits = null,
            MonthlyPrice = 14.99m,
            AnnualPrice = 152.90m,
            StripePriceIdMonthly = "price_monthly",
            StripePriceIdAnnual = "price_annual",
        });
        fixture.Stripe.Setup(service => service.CreateCustomerAsync(
                fixture.User.Email, It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
            .ReturnsAsync(new ServiceResponse<Stripe.Customer> { Data = new Stripe.Customer { Id = "cus_tenant" } });
        fixture.Stripe.Setup(service => service.CreateCheckoutSessionAsync(
                "cus_tenant", expectedPriceId, "/success", "/cancel", null))
            .ReturnsAsync(new ServiceResponse<string> { Data = "https://checkout.example/session" });

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = premium.Id,
            BillingCycle = billingCycle,
            SuccessUrl = "/success",
            CancelUrl = "/cancel",
        });

        result.Success.Should().BeTrue();
        result.Data.Should().Be("https://checkout.example/session");
        fixture.Subscriptions.Verify(repository => repository.CreateSubscriptionAsync(It.Is<Subscription>(value =>
            value.Status == "PaymentPending" && value.BillingCycle == billingCycle)), Times.Once);
        fixture.Stripe.Verify(service => service.CreateCheckoutSessionAsync(
            "cus_tenant", expectedPriceId, "/success", "/cancel", null), Times.Once);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public async Task Checkout_TenantProviderSuccessWithoutSessionUrl_FailsClosed(string? sessionUrl)
    {
        var fixture = new CheckoutFixture();
        var premium = fixture.AddPlan(new SubscriptionPlan
        {
            Id = 2,
            Name = "Premium",
            IsActive = true,
            MonthlyPrice = 14.99m,
            AnnualPrice = 152.90m,
            StripePriceIdMonthly = "price_monthly",
            StripePriceIdAnnual = "price_annual",
        });
        fixture.Stripe.Setup(service => service.CreateCustomerAsync(
                fixture.User.Email, It.IsAny<string>(), It.IsAny<Dictionary<string, string>>()))
            .ReturnsAsync(new ServiceResponse<Stripe.Customer> { Data = new Stripe.Customer { Id = "cus_tenant" } });
        fixture.Stripe.Setup(service => service.CreateCheckoutSessionAsync(
                "cus_tenant", "price_monthly", "/success", "/cancel", null))
            .ReturnsAsync(new ServiceResponse<string> { Success = true, Data = sessionUrl });

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = premium.Id,
            BillingCycle = "Monthly",
            SuccessUrl = "/success",
            CancelUrl = "/cancel",
        });

        result.Success.Should().BeFalse();
        result.Data.Should().BeNull();
    }

    [Theory]
    [InlineData("Monthly")]
    [InlineData("Annual")]
    public async Task Checkout_MissingApplicablePrice_FailsWithoutCustomerOrSubscriptionWrites(string billingCycle)
    {
        var fixture = new CheckoutFixture();
        fixture.AddPlan(new SubscriptionPlan
        {
            Id = 2,
            Name = "Premium",
            IsActive = true,
            MonthlyPrice = 14.99m,
            AnnualPrice = 152.90m,
            StripePriceIdMonthly = billingCycle == "Monthly" ? null : "price_monthly",
            StripePriceIdAnnual = billingCycle == "Annual" ? " " : "price_annual",
        });

        var result = await fixture.Service.CreateCheckoutSessionAsync(new CreateCheckoutSessionDto
        {
            PlanId = 2,
            BillingCycle = billingCycle,
        });

        result.Success.Should().BeFalse();
        result.Message.Should().Be($"Price ID not configured for {billingCycle} billing");
        result.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        fixture.Subscriptions.Verify(repository => repository.CreateSubscriptionAsync(It.IsAny<Subscription>()), Times.Never);
        fixture.Subscriptions.Verify(repository => repository.UpdateSubscriptionAsync(It.IsAny<Subscription>()), Times.Never);
        fixture.Organizations.Verify(repository => repository.UpdateOrganizationAsync(It.IsAny<Organization>()), Times.Never);
        fixture.Stripe.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Seeder_UsesCanonicalAmountsAndFailsProviderMappingsClosedWhenAmountsDisagree()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"packaging-{Guid.NewGuid()}")
            .Options;
        await using var context = new DataContext(options);
        context.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Name = "Premium",
            MonthlyPrice = 12.34m,
            AnnualPrice = 123.45m,
            StripePriceIdMonthly = "price_unverified_monthly",
            StripePriceIdAnnual = "price_unverified_annual",
            IsActive = true,
        });
        await context.SaveChangesAsync();

        await SubscriptionPlanSeeder.SeedSubscriptionPlansAsync(context);

        var premium = await context.SubscriptionPlans.SingleAsync(plan => plan.Name == "Premium");
        premium.MonthlyPrice.Should().Be(14.99m);
        premium.AnnualPrice.Should().Be(152.90m);
        premium.StripePriceIdMonthly.Should().BeNull();
        premium.StripePriceIdAnnual.Should().BeNull();
        premium.MaxTotalUnits.Should().BeNull();
    }

    private sealed class CheckoutFixture
    {
        public User User { get; } = new()
        {
            Id = 42,
            Email = "tenant@example.test",
            FirstName = "Test",
            LastName = "Tenant",
        };

        private LoadUserDto CurrentUser => new()
        {
            Id = User.Id,
            Email = User.Email,
            Roles = ["Tenant"],
        };

        public Mock<ISubscriptionRepository> Subscriptions { get; } = new();
        public Mock<ISubscriptionPlanRepository> Plans { get; } = new();
        public Mock<IUserRepository> Users { get; } = new();
        public Mock<IOrganizationMemberRepository> Members { get; } = new();
        public Mock<IOrganizationRepository> Organizations { get; } = new();
        public Mock<IStripeService> Stripe { get; } = new();
        public brownstone_hub_api.Services.SubscriptionService.SubscriptionService Service { get; }

        public CheckoutFixture()
        {
            Users.Setup(repository => repository.GetCurrentUser()).ReturnsAsync(CurrentUser);
            Users.Setup(repository => repository.GetUser(User.Id)).ReturnsAsync(User);
            Subscriptions.Setup(repository => repository.GetSubscriptionByUserIdAsync(User.Id))
                .ReturnsAsync((Subscription?)null);
            Subscriptions.Setup(repository => repository.CreateSubscriptionAsync(It.IsAny<Subscription>()))
                .ReturnsAsync((Subscription value) =>
                {
                    value.Id = 100;
                    return value;
                });
            Subscriptions.Setup(repository => repository.UpdateSubscriptionAsync(It.IsAny<Subscription>()))
                .ReturnsAsync((Subscription value) => value);

            var mapper = new Mock<IMapper>();
            mapper.Setup(value => value.Map<SubscriptionDto>(It.IsAny<Subscription>()))
                .Returns((Subscription value) => new SubscriptionDto { Id = value.Id });
            mapper.Setup(value => value.Map<SubscriptionPlanDto>(It.IsAny<SubscriptionPlan>()))
                .Returns((SubscriptionPlan value) => new SubscriptionPlanDto { Id = value.Id, Name = value.Name });

            Service = new brownstone_hub_api.Services.SubscriptionService.SubscriptionService(
                Subscriptions.Object,
                Plans.Object,
                Mock.Of<ISubscriptionHistoryRepository>(),
                Users.Object,
                Members.Object,
                Organizations.Object,
                Stripe.Object,
                Mock.Of<IFeatureGateService>(),
                Mock.Of<IEntitlementDecisionService>(),
                new HttpContextAccessor(),
                mapper.Object,
                Mock.Of<ILogger<brownstone_hub_api.Services.SubscriptionService.SubscriptionService>>());
        }

        public SubscriptionPlan AddPlan(SubscriptionPlan plan)
        {
            Plans.Setup(repository => repository.GetPlanByIdAsync(plan.Id)).ReturnsAsync(plan);
            return plan;
        }
    }
}
