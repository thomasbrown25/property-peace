using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.AdminSettings;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public class FeatureGateOrganizationIsolationTests
{
    [Fact]
    public async Task Entitlement_uses_current_organization_subscription_before_an_owner_subscription()
    {
        await using var context = CreateContext();
        var subscriptions = new Mock<ISubscriptionRepository>();
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOrganizationIdAsync(17))
            .ReturnsAsync(CreateSubscription("Free"));
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOwnerUserIdAsync(42))
            .ReturnsAsync(CreateSubscription("Premium Plan"));

        var service = CreateService(context, subscriptions, userId: 42, organizationId: 17);

        var entitlement = await service.GetListingSyndicationEntitlementAsync(42);

        subscriptions.Verify(
            repository => repository.GetSubscriptionByOrganizationIdAsync(17),
            Times.Once);
        subscriptions.Verify(
            repository => repository.GetSubscriptionByOwnerUserIdAsync(It.IsAny<long>()),
            Times.Never);
        entitlement.CanUseCoreDestinations.Should().BeTrue();
        entitlement.CanUseExtendedDestinations.Should().BeFalse();
        entitlement.MaxActiveExternalListings.Should().Be(1);
    }

    [Fact]
    public async Task Entitlement_does_not_borrow_managers_owner_subscription_when_org_has_none()
    {
        await using var context = CreateContext();
        context.Organizations.Add(new Organization { Id = 17, OwnerId = 99, Name = "Managed org" });
        await context.SaveChangesAsync();

        var subscriptions = new Mock<ISubscriptionRepository>();
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOrganizationIdAsync(17))
            .ReturnsAsync((Subscription?)null);
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOwnerUserIdAsync(42))
            .ReturnsAsync(CreateSubscription("Premium Plan"));

        var service = CreateService(context, subscriptions, userId: 42, organizationId: 17);

        var entitlement = await service.GetListingSyndicationEntitlementAsync(42);

        entitlement.Should().Be(ListingSyndicationEntitlement.None);
        subscriptions.Verify(
            repository => repository.GetSubscriptionByOwnerUserIdAsync(It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task Entitlement_can_use_owner_subscription_for_an_org_the_user_owns()
    {
        await using var context = CreateContext();
        context.Organizations.Add(new Organization { Id = 17, OwnerId = 42, Name = "Owned org" });
        await context.SaveChangesAsync();

        var subscriptions = new Mock<ISubscriptionRepository>();
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOrganizationIdAsync(17))
            .ReturnsAsync((Subscription?)null);
        subscriptions
            .Setup(repository => repository.GetSubscriptionByOwnerUserIdAsync(42))
            .ReturnsAsync(CreateSubscription("Premium Plan"));

        var service = CreateService(context, subscriptions, userId: 42, organizationId: 17);

        var entitlement = await service.GetListingSyndicationEntitlementAsync(42);

        entitlement.CanUseExtendedDestinations.Should().BeTrue();
        entitlement.MaxActiveExternalListings.Should().BeNull();
    }

    private static DataContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"feature-gate-org-{Guid.NewGuid()}")
            .Options;
        return new DataContext(options);
    }

    private static FeatureGateService CreateService(
        DataContext context,
        Mock<ISubscriptionRepository> subscriptions,
        long userId,
        long organizationId)
    {
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetCurrentUser())
            .ReturnsAsync(new LoadUserDto { Id = userId, Roles = ["Landlord"] });

        var httpContext = new DefaultHttpContext();
        httpContext.Items["OrganizationId"] = organizationId;

        return new FeatureGateService(
            subscriptions.Object,
            Mock.Of<IPropertyRepository>(),
            users.Object,
            Mock.Of<IAdminSettingsRepository>(),
            context,
            new HttpContextAccessor { HttpContext = httpContext },
            Mock.Of<ILogger<FeatureGateService>>());
    }

    private static Subscription CreateSubscription(string planName) => new()
    {
        Status = "Active",
        BillingCycle = "Monthly",
        SubscriptionPlan = new SubscriptionPlan { Name = planName }
    };
}
