using AutoMapper;
using brownstone_hub_api.Dtos.Subscription;
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

public sealed class AdminLifetimeAssignmentTests
{
    [Fact]
    public async Task AssignLifetimePlanAsync_PreservesExplicitAdminOnlyAssignmentPath()
    {
        var user = new User
        {
            Id = 42,
            Email = "lifetime@example.test",
            CurrentOrganizationId = 17
        };
        var organization = new Organization { Id = 17, OwnerId = user.Id };
        var lifetime = new SubscriptionPlan
        {
            Id = 731,
            Name = "Lifetime Plan",
            IsActive = true,
            MonthlyPrice = 0,
            AnnualPrice = 0
        };

        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetUser(user.Id)).ReturnsAsync(user);
        var plans = new Mock<ISubscriptionPlanRepository>();
        plans.Setup(repository => repository.GetPlanByNameAsync("Lifetime Plan")).ReturnsAsync(lifetime);
        var organizations = new Mock<IOrganizationRepository>();
        organizations.Setup(repository => repository.GetOrganizationByIdAsync(organization.Id)).ReturnsAsync(organization);
        organizations.Setup(repository => repository.UpdateOrganizationAsync(organization)).ReturnsAsync(organization);
        var subscriptions = new Mock<ISubscriptionRepository>();
        subscriptions.Setup(repository => repository.GetSubscriptionByOwnerUserIdAsync(user.Id))
            .ReturnsAsync((Subscription?)null);
        subscriptions.Setup(repository => repository.GetSubscriptionByOrganizationIdAsync(organization.Id))
            .ReturnsAsync((Subscription?)null);
        subscriptions.Setup(repository => repository.CreateSubscriptionAsync(It.IsAny<Subscription>()))
            .ReturnsAsync((Subscription value) =>
            {
                value.Id = 99;
                return value;
            });
        var history = new Mock<ISubscriptionHistoryRepository>();
        var mapper = new Mock<IMapper>();
        mapper.Setup(value => value.Map<SubscriptionDto>(It.IsAny<Subscription>()))
            .Returns((Subscription value) => new SubscriptionDto { Id = value.Id });
        mapper.Setup(value => value.Map<SubscriptionPlanDto>(lifetime))
            .Returns(new SubscriptionPlanDto { Id = lifetime.Id, Name = lifetime.Name });
        var stripe = new Mock<IStripeService>(MockBehavior.Strict);

        var service = new brownstone_hub_api.Services.SubscriptionService.SubscriptionService(
            subscriptions.Object,
            plans.Object,
            history.Object,
            users.Object,
            Mock.Of<IOrganizationMemberRepository>(),
            organizations.Object,
            stripe.Object,
            Mock.Of<IFeatureGateService>(),
            Mock.Of<IEntitlementDecisionService>(),
            new HttpContextAccessor(),
            mapper.Object,
            Mock.Of<ILogger<brownstone_hub_api.Services.SubscriptionService.SubscriptionService>>());

        var result = await service.AssignLifetimePlanAsync(new AdminAssignLifetimePlanDto { UserId = user.Id });

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Plan.Name.Should().Be("Lifetime Plan");
        subscriptions.Verify(repository => repository.CreateSubscriptionAsync(It.Is<Subscription>(value =>
            value.OrganizationId == organization.Id
            && value.OwnerUserId == user.Id
            && value.SubscriptionPlanId == lifetime.Id
            && value.Status == "Active"
            && value.BillingCycle == "Lifetime"
            && value.StripeSubscriptionId == null)), Times.Once);
        history.Verify(repository => repository.AddHistoryAsync(It.Is<SubscriptionHistory>(value =>
            value.EventType == "LifetimePlanAssigned" && value.NewPlanId == lifetime.Id)), Times.Once);
        stripe.VerifyNoOtherCalls();
    }
}
