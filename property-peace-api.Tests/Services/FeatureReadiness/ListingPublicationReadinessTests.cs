using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Listing;
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

public sealed class ListingPublicationReadinessTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PublishListing_PublishesHostedPage_WithoutExternalSyndicationReadiness(bool canInvoke)
    {
        var (controller, listings, readiness) = CreateController(canInvoke);
        listings.Setup(service => service.PublishListing(17))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateSuccess(new LoadListingDto()));

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<OkObjectResult>();
        listings.Verify(service => service.PublishListing(17), Times.Once);
        readiness.Verify(
            service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication),
            Times.Once);

        listings.Verify(
            service => service.UpdateListing(It.Is<UpdateListingDto>(dto =>
                dto.Id == 17 &&
                dto.SyndicateToFreeSites == false &&
                dto.SyndicateToPremiumSites == false)),
            canInvoke ? Times.Never : Times.Once);
    }

    [Fact]
    public async Task PublishListing_PropagatesHostedPublicationFailure()
    {
        var (controller, listings, _) = CreateController(canInvoke: false);
        listings.Setup(service => service.PublishListing(17))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateError("Unable to publish", "Validation failed", "", 422));

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(422);
        listings.Verify(service => service.PublishListing(17), Times.Once);
    }

    [Fact]
    public async Task PublishListing_ClearsFreeExternalFlag_WhenAnotherActiveExternalListingUsesAllowance()
    {
        var (controller, listings, _) = CreateController(
            canInvoke: true,
            existingListings:
            [
                new LoadListingDto
                {
                    Id = 99,
                    Status = brownstone_hub_api.Enums.EListingStatus.Active,
                    SyndicateToFreeSites = true,
                },
            ]);
        listings.Setup(service => service.PublishListing(17))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateSuccess(new LoadListingDto()));

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<OkObjectResult>();
        listings.Verify(service => service.UpdateListing(It.Is<UpdateListingDto>(dto =>
            dto.Id == 17 && dto.SyndicateToFreeSites == false)), Times.Once);
        listings.Verify(service => service.PublishListing(17), Times.Once);
    }

    private static (
        ListingController Controller,
        Mock<IListingService> Listings,
        Mock<IFeatureReadinessService> Readiness) CreateController(
        bool canInvoke,
        List<LoadListingDto>? existingListings = null)
    {
        var listings = new Mock<IListingService>();
        listings.Setup(service => service.GetListingById(17))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateSuccess(new LoadListingDto
            {
                Id = 17,
                SyndicateToListingWebsite = true,
                SyndicateToFreeSites = true,
                SyndicateToPremiumSites = false,
            }));
        listings.Setup(service => service.GetListingsByOrganization())
            .ReturnsAsync(ServiceResponse<List<LoadListingDto>>.CreateSuccess(existingListings ?? []));
        listings.Setup(service => service.UpdateListing(It.IsAny<UpdateListingDto>()))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateSuccess(new LoadListingDto()));

        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication))
            .ReturnsAsync(ReadinessResult(canInvoke));

        var featureGate = new Mock<IFeatureGateService>();
        featureGate.Setup(service => service.GetListingSyndicationEntitlementAsync(42))
            .ReturnsAsync(new ListingSyndicationEntitlement(
                CanUseCoreDestinations: true,
                CanUseExtendedDestinations: false,
                MaxActiveExternalListings: 1));

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
        return (controller, listings, readiness);
    }

    private static FeatureReadinessDto ReadinessResult(bool canInvoke) => new(
        FeatureKeys.ListingSyndication,
        canInvoke ? FeatureReadinessState.Available : FeatureReadinessState.ComingSoon,
        canInvoke,
        true,
        canInvoke,
        true,
        canInvoke,
        true,
        canInvoke ? [] : ["GlobalGate"]);
}
