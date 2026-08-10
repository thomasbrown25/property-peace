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

public sealed class SubscriptionLifecycleAuthorityTests
{
    public static TheoryData<string, string> StripeStatuses => new()
    {
        { "past_due", "PastDue" },
        { "canceled", "Cancelled" },
        { "unpaid", "Unpaid" },
        { "incomplete", "Incomplete" },
        { "incomplete_expired", "IncompleteExpired" },
        { "active", "Active" },
        { "trialing", "Trial" }
    };

    [Theory]
    [MemberData(nameof(StripeStatuses))]
    public async Task SubscribeAsync_NewPaidSubscription_PersistsStripeLifecycleStatus(string stripeStatus, string expectedLocalStatus)
    {
        var fixture = new Fixture();
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByOrganizationIdAsync(Fixture.OrganizationId))
            .ReturnsAsync((Subscription?)null);
        fixture.Stripe.Setup(x => x.CreateSubscriptionAsync("cus_1", "price_monthly", null, null, null))
            .ReturnsAsync(StripeResponse(stripeStatus));

        var result = await fixture.Service.SubscribeAsync(new CreateSubscriptionDto
        {
            PlanId = fixture.PremiumPlan.Id,
            BillingCycle = "Monthly"
        });

        result.Success.Should().BeTrue(result.Message);
        fixture.Subscriptions.Verify(x => x.CreateSubscriptionAsync(
            It.Is<Subscription>(subscription => subscription.Status == expectedLocalStatus)), Times.Once);
    }

    [Theory]
    [MemberData(nameof(StripeStatuses))]
    public async Task UpgradeSubscriptionAsync_PersistsStripeLifecycleStatus(string stripeStatus, string expectedLocalStatus)
    {
        var fixture = new Fixture();
        var subscription = fixture.CreateLocalSubscription();
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByOwnerUserIdAsync(Fixture.UserId)).ReturnsAsync(subscription);
        fixture.Stripe.Setup(x => x.UpdateSubscriptionAsync("sub_1", "price_monthly", true))
            .ReturnsAsync(StripeResponse(stripeStatus));

        var result = await fixture.Service.UpgradeSubscriptionAsync(new UpdateSubscriptionDto
        {
            NewPlanId = fixture.PremiumPlan.Id,
            BillingCycle = "Monthly"
        });

        result.Success.Should().BeTrue(result.Message);
        subscription.Status.Should().Be(expectedLocalStatus);
    }

    [Theory]
    [MemberData(nameof(StripeStatuses))]
    public async Task UpgradeSubscriptionAsync_Reactivation_PersistsStripeLifecycleStatus(string stripeStatus, string expectedLocalStatus)
    {
        var fixture = new Fixture();
        var subscription = fixture.CreateLocalSubscription();
        subscription.CancelAtPeriodEnd = true;
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByOwnerUserIdAsync(Fixture.UserId)).ReturnsAsync(subscription);
        fixture.Stripe.Setup(x => x.GetSubscriptionAsync("sub_1"))
            .ReturnsAsync(StripeResponse("active", cancelAtPeriodEnd: true));
        fixture.Stripe.Setup(x => x.ResumeSubscriptionAsync("sub_1"))
            .ReturnsAsync(StripeResponse(stripeStatus));

        var result = await fixture.Service.UpgradeSubscriptionAsync(new UpdateSubscriptionDto
        {
            NewPlanId = fixture.PremiumPlan.Id,
            BillingCycle = "Monthly"
        });

        result.Success.Should().BeTrue(result.Message);
        subscription.Status.Should().Be(expectedLocalStatus);
    }

    [Theory]
    [MemberData(nameof(StripeStatuses))]
    public async Task FixOrphanedSubscriptionAsync_PersistsStripeLifecycleStatus(string stripeStatus, string expectedLocalStatus)
    {
        var fixture = new Fixture();
        var subscription = fixture.CreateLocalSubscription();
        subscription.SubscriptionPlanId = fixture.PremiumPlan.Id;
        subscription.SubscriptionPlan = fixture.PremiumPlan;
        subscription.StripeSubscriptionId = null;
        subscription.StripeCustomerId = null;
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByIdAsync(subscription.Id)).ReturnsAsync(subscription);
        fixture.Organizations.Setup(x => x.GetOrganizationByIdWithMembersAsync(Fixture.OrganizationId))
            .ReturnsAsync(fixture.Organization);
        fixture.Stripe.Setup(x => x.CreateSubscriptionAsync("cus_1", "price_monthly", null, null, null))
            .ReturnsAsync(StripeResponse(stripeStatus));

        var result = await fixture.Service.FixOrphanedSubscriptionAsync(subscription.Id);

        result.Success.Should().BeTrue(result.Message);
        subscription.Status.Should().Be(expectedLocalStatus);
    }

    [Theory]
    [MemberData(nameof(StripeStatuses))]
    public async Task ResumeSubscriptionAsync_PersistsStripeLifecycleStatus(string stripeStatus, string expectedLocalStatus)
    {
        var fixture = new Fixture();
        var subscription = fixture.CreateLocalSubscription();
        subscription.CancelAtPeriodEnd = true;
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByOwnerUserIdAsync(Fixture.UserId)).ReturnsAsync(subscription);
        fixture.Stripe.Setup(x => x.ResumeSubscriptionAsync("sub_1"))
            .ReturnsAsync(StripeResponse(stripeStatus));

        var result = await fixture.Service.ResumeSubscriptionAsync();

        result.Success.Should().BeTrue(result.Message);
        subscription.Status.Should().Be(expectedLocalStatus);
        subscription.CancelAtPeriodEnd.Should().BeFalse();
    }

    [Fact]
    public async Task PauseSubscriptionAsync_AtPeriodEnd_KeepsCurrentLifecycleStatusUntilBoundary()
    {
        var fixture = new Fixture();
        var subscription = fixture.CreateLocalSubscription();
        var periodEnd = DateTime.UtcNow.AddDays(12);
        subscription.Status = "Active";
        subscription.CurrentPeriodEnd = periodEnd;
        fixture.Subscriptions.Setup(x => x.GetSubscriptionByOwnerUserIdAsync(Fixture.UserId)).ReturnsAsync(subscription);
        fixture.Stripe.Setup(x => x.PauseSubscriptionAsync("sub_1", periodEnd))
            .ReturnsAsync(new ServiceResponse<Stripe.Subscription> { Data = new Stripe.Subscription() });

        var result = await fixture.Service.PauseSubscriptionAsync(pauseAtPeriodEnd: true);

        result.Success.Should().BeTrue(result.Message);
        subscription.PausedAtPeriodEnd.Should().BeTrue();
        subscription.PausedAt.Should().BeNull();
        subscription.Status.Should().Be("Active");
    }

    private static ServiceResponse<Stripe.Subscription> StripeResponse(string status, bool cancelAtPeriodEnd = false) => new()
    {
        Data = new Stripe.Subscription
        {
            Id = "sub_stripe",
            CustomerId = "cus_1",
            Status = status,
            CancelAtPeriodEnd = cancelAtPeriodEnd,
            CurrentPeriodStart = DateTime.UtcNow.AddDays(-3),
            CurrentPeriodEnd = DateTime.UtcNow.AddDays(27)
        }
    };

    private sealed class Fixture
    {
        public const long UserId = 42;
        public const long OrganizationId = 17;

        public Mock<ISubscriptionRepository> Subscriptions { get; } = new();
        public Mock<ISubscriptionPlanRepository> Plans { get; } = new();
        public Mock<ISubscriptionHistoryRepository> History { get; } = new();
        public Mock<IUserRepository> Users { get; } = new();
        public Mock<IOrganizationMemberRepository> Members { get; } = new();
        public Mock<IOrganizationRepository> Organizations { get; } = new();
        public Mock<IStripeService> Stripe { get; } = new();
        public SubscriptionPlan PremiumPlan { get; } = new()
        {
            Id = 2,
            Name = "Premium",
            IsActive = true,
            MonthlyPrice = 25,
            AnnualPrice = 250,
            StripePriceIdMonthly = "price_monthly",
            StripePriceIdAnnual = "price_annual"
        };
        public Organization Organization { get; }
        public brownstone_hub_api.Services.SubscriptionService.SubscriptionService Service { get; }

        public Fixture()
        {
            Organization = new Organization
            {
                Id = OrganizationId,
                Name = "Test organization",
                OwnerId = UserId,
                StripeCustomerId = "cus_1",
                Owner = new User { Id = UserId, Email = "owner@example.test" }
            };

            Users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto
            {
                Id = UserId,
                Roles = ["Landlord"]
            });
            Users.Setup(x => x.GetUser(UserId)).ReturnsAsync(new User
            {
                Id = UserId,
                Email = "owner@example.test",
                CurrentOrganizationId = OrganizationId
            });
            Members.Setup(x => x.GetMemberAsync(OrganizationId, UserId)).ReturnsAsync(new OrganizationMember
            {
                OrganizationId = OrganizationId,
                UserId = UserId,
                Role = "Owner",
                IsActive = true
            });
            Organizations.Setup(x => x.GetOrganizationByIdAsync(OrganizationId)).ReturnsAsync(Organization);
            Organizations.Setup(x => x.UpdateOrganizationAsync(It.IsAny<Organization>()))
                .ReturnsAsync((Organization organization) => organization);
            Plans.Setup(x => x.GetPlanByIdAsync(PremiumPlan.Id)).ReturnsAsync(PremiumPlan);
            Subscriptions.Setup(x => x.CreateSubscriptionAsync(It.IsAny<Subscription>()))
                .ReturnsAsync((Subscription subscription) =>
                {
                    subscription.Id = 99;
                    subscription.SubscriptionPlan = PremiumPlan;
                    return subscription;
                });
            Subscriptions.Setup(x => x.UpdateSubscriptionAsync(It.IsAny<Subscription>()))
                .ReturnsAsync((Subscription subscription) => subscription);
            Stripe.Setup(x => x.GetCustomerAsync("cus_1"))
                .ReturnsAsync(new ServiceResponse<Stripe.Customer> { Data = new Stripe.Customer { Id = "cus_1" } });

            var mapper = new Mock<IMapper>();
            mapper.Setup(x => x.Map<SubscriptionDto>(It.IsAny<Subscription>()))
                .Returns((Subscription subscription) => new SubscriptionDto
                {
                    Id = subscription.Id,
                    Status = subscription.Status
                });
            mapper.Setup(x => x.Map<SubscriptionPlanDto>(It.IsAny<SubscriptionPlan>()))
                .Returns((SubscriptionPlan plan) => new SubscriptionPlanDto { Id = plan.Id, Name = plan.Name });

            var context = new DefaultHttpContext();
            context.Items["OrganizationId"] = OrganizationId;
            Service = new brownstone_hub_api.Services.SubscriptionService.SubscriptionService(
                Subscriptions.Object,
                Plans.Object,
                History.Object,
                Users.Object,
                Members.Object,
                Organizations.Object,
                Stripe.Object,
                Mock.Of<IFeatureGateService>(),
                Mock.Of<IEntitlementDecisionService>(),
                new HttpContextAccessor { HttpContext = context },
                mapper.Object,
                Mock.Of<ILogger<brownstone_hub_api.Services.SubscriptionService.SubscriptionService>>());
        }

        public Subscription CreateLocalSubscription() => new()
        {
            Id = 7,
            OrganizationId = OrganizationId,
            OwnerUserId = UserId,
            SubscriptionPlanId = 1,
            SubscriptionPlan = new SubscriptionPlan
            {
                Id = 1,
                Name = "Free",
                IsActive = true,
                MonthlyPrice = 0,
                AnnualPrice = 0
            },
            StripeSubscriptionId = "sub_1",
            StripeCustomerId = "cus_1",
            Status = "Active",
            BillingCycle = "Monthly"
        };
    }
}
