using AutoMapper;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public sealed class SubscriptionPlanVisibilityTests
{
    [Fact]
    public async Task GetAllPlansAsync_HidesLifetimePlanFromCustomerPlanList()
    {
        var plans = new List<SubscriptionPlan>
        {
            new() { Id = 1, Name = "Free", IsActive = true },
            new() { Id = 2, Name = "Premium", IsActive = true },
            new() { Id = 3, Name = "Lifetime Plan", IsActive = true },
        };

        var repository = new Mock<ISubscriptionPlanRepository>();
        repository.Setup(repo => repo.GetAllPlansAsync()).ReturnsAsync(plans);

        var mapper = new Mock<IMapper>();
        mapper.Setup(value => value.Map<SubscriptionPlanDto>(It.IsAny<SubscriptionPlan>()))
            .Returns((SubscriptionPlan plan) => new SubscriptionPlanDto
            {
                Id = plan.Id,
                Name = plan.Name,
                IsActive = plan.IsActive,
            });

        var service = new SubscriptionPlanService(
            repository.Object,
            Mock.Of<IStripeService>(),
            Mock.Of<IStripeSyncService>(),
            mapper.Object,
            Mock.Of<ILogger<SubscriptionPlanService>>());

        var response = await service.GetAllPlansAsync();

        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.Select(plan => plan.Name).Should().Equal("Free", "Premium");
        response.Data.Should().NotContain(plan => plan.Name == "Lifetime Plan");
    }
}
