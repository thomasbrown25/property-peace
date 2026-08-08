using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.ListingAIService;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public sealed class ListingSyndicationWriteProtectionTests
{
    [Fact]
    public async Task CreateListing_PreservesHostedPageAndBlocksExternalFlags_WhenReadinessIsBlocked()
    {
        var (controller, listings) = CreateController(canInvoke: false);
        var dto = new CreateListingDto
        {
            PropertyId = 7,
            SyndicateToListingWebsite = true,
            SyndicateToFreeSites = true,
            SyndicateToPremiumSites = true,
        };

        await controller.CreateListing(dto, null);

        dto.SyndicateToListingWebsite.Should().BeTrue();
        dto.SyndicateToFreeSites.Should().BeFalse();
        dto.SyndicateToPremiumSites.Should().BeFalse();
        listings.Verify(service => service.CreateListing(dto, null), Times.Once);
    }

    [Fact]
    public async Task UpdateListing_PreservesHostedPageAndBlocksExternalFlags_WhenReadinessIsBlocked()
    {
        var (controller, listings) = CreateController(canInvoke: false);
        var dto = new UpdateListingDto
        {
            SyndicateToListingWebsite = true,
            SyndicateToFreeSites = true,
            SyndicateToPremiumSites = true,
        };

        await controller.UpdateListing(11, dto);

        dto.Id.Should().Be(11);
        dto.SyndicateToListingWebsite.Should().BeTrue();
        dto.SyndicateToFreeSites.Should().BeFalse();
        dto.SyndicateToPremiumSites.Should().BeFalse();
        listings.Verify(service => service.UpdateListing(dto), Times.Once);
    }

    [Fact]
    public async Task CreateListing_KeepsCoreAndStripsExtended_ForFreeAllowance()
    {
        var (controller, _) = CreateController(canInvoke: true, canUseExtended: false);
        var dto = new CreateListingDto
        {
            PropertyId = 7,
            SyndicateToListingWebsite = true,
            SyndicateToFreeSites = true,
            SyndicateToPremiumSites = true,
        };

        await controller.CreateListing(dto, null);

        dto.SyndicateToListingWebsite.Should().BeTrue();
        dto.SyndicateToFreeSites.Should().BeTrue();
        dto.SyndicateToPremiumSites.Should().BeFalse();
    }

    [Fact]
    public async Task CreateListing_KeepsCoreAndExtended_ForPremiumOrLifetimeAllowance()
    {
        var (controller, _) = CreateController(canInvoke: true, canUseExtended: true);
        var dto = new CreateListingDto
        {
            PropertyId = 7,
            SyndicateToListingWebsite = true,
            SyndicateToFreeSites = true,
            SyndicateToPremiumSites = true,
        };

        await controller.CreateListing(dto, null);

        dto.SyndicateToListingWebsite.Should().BeTrue();
        dto.SyndicateToFreeSites.Should().BeTrue();
        dto.SyndicateToPremiumSites.Should().BeTrue();
    }

    [Fact]
    public async Task CreateListing_StripsCoreDistribution_WhenFreeActiveListingLimitIsReached()
    {
        var existingListings = new List<LoadListingDto>
        {
            new() { Id = 91, Status = EListingStatus.Active, SyndicateToFreeSites = true },
        };
        var (controller, _) = CreateController(
            canInvoke: true,
            canUseExtended: false,
            existingListings: existingListings);
        var dto = new CreateListingDto
        {
            PropertyId = 7,
            SyndicateToListingWebsite = true,
            SyndicateToFreeSites = true,
        };

        await controller.CreateListing(dto, null);

        dto.SyndicateToListingWebsite.Should().BeTrue();
        dto.SyndicateToFreeSites.Should().BeFalse();
        dto.SyndicateToPremiumSites.Should().BeFalse();
    }

    private static (ListingController Controller, Mock<IListingService> Listings) CreateController(
        bool canInvoke,
        bool canUseExtended = false,
        List<LoadListingDto>? existingListings = null)
    {
        var listings = new Mock<IListingService>();
        listings.Setup(service => service.CreateListing(It.IsAny<CreateListingDto>(), It.IsAny<List<IFormFile>>()))
            .ReturnsAsync(new ServiceResponse<LoadListingDto>());
        listings.Setup(service => service.UpdateListing(It.IsAny<UpdateListingDto>()))
            .ReturnsAsync(new ServiceResponse<LoadListingDto>());
        listings.Setup(service => service.GetListingsByOrganization())
            .ReturnsAsync(ServiceResponse<List<LoadListingDto>>.CreateSuccess(existingListings ?? []));

        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication))
            .ReturnsAsync(new FeatureReadinessDto(
                FeatureKeys.ListingSyndication,
                canInvoke ? FeatureReadinessState.Available : FeatureReadinessState.ComingSoon,
                canInvoke,
                true,
                canInvoke,
                true,
                canInvoke,
                true,
                canInvoke ? [] : ["GlobalGate"]));

        var featureGate = new Mock<IFeatureGateService>();
        featureGate.Setup(service => service.GetListingSyndicationEntitlementAsync(42))
            .ReturnsAsync(new ListingSyndicationEntitlement(
                CanUseCoreDestinations: true,
                CanUseExtendedDestinations: canUseExtended,
                MaxActiveExternalListings: canUseExtended ? null : 1));

        var controller = new ListingController(
            listings.Object,
            Mock.Of<IListingAIService>(),
            readiness.Object,
            featureGate.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "42")], "test")),
                },
            },
        };
        controller.HttpContext.Items["OrganizationId"] = 17L;

        return (controller, listings);
    }
}
