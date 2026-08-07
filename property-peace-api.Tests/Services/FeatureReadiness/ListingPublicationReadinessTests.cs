using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.ListingAIService;
using brownstone_hub_api.Services.ListingService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public sealed class ListingPublicationReadinessTests
{
    [Fact]
    public async Task PublishListing_UsesCanonicalRequestOrganizationForReadiness()
    {
        var (controller, listings, readiness) = CreateController(canInvoke: false, organizationId: 99);

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        readiness.Verify(service => service.GetAsync(42, 99, FeatureKeys.ListingSyndication), Times.Once);
        listings.Verify(service => service.PublishListing(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task PublishListing_ReturnsForbiddenWithoutPublishing_WhenSyndicationIsNotReady()
    {
        var (controller, listings, readiness) = CreateController(canInvoke: false);

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        readiness.Verify(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication), Times.Once);
        listings.Verify(service => service.PublishListing(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task PublishListing_ReturnsUnauthorizedWithoutReadinessOrPublishing_WhenIdentityIsMissing()
    {
        var (controller, listings, readiness) = CreateController(canInvoke: true, userId: null);

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<UnauthorizedObjectResult>();
        readiness.Verify(service => service.GetAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<string>()), Times.Never);
        listings.Verify(service => service.PublishListing(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task PublishListing_ReturnsServiceUnavailableWithoutPublishing_WhenReadinessEvaluationErrors()
    {
        var (controller, listings, readiness) = CreateController(canInvoke: true, readinessThrows: true);

        var action = async () => await controller.PublishListing(17);

        var result = await action.Should().NotThrowAsync();
        result.Which.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        readiness.Verify(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication), Times.Once);
        listings.Verify(service => service.PublishListing(It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData(ClaimTypes.NameIdentifier)]
    [InlineData("userId")]
    [InlineData("sub")]
    public async Task PublishListing_ChecksAuthenticatedOwnersReadinessBeforePublishing_WhenConfirmed(string claimType)
    {
        var calls = new List<string>();
        var (controller, listings, readiness) = CreateController(canInvoke: true, claimType: claimType, calls: calls);

        var result = await controller.PublishListing(17);

        result.Should().BeOfType<OkObjectResult>();
        calls.Should().Equal("readiness", "publish");
        readiness.Verify(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication), Times.Once);
        listings.Verify(service => service.PublishListing(17), Times.Once);
    }

    private static (
        ListingController Controller,
        Mock<IListingService> Listings,
        Mock<IFeatureReadinessService> Readiness) CreateController(
            bool canInvoke,
            long? userId = 42,
            bool readinessThrows = false,
            string claimType = ClaimTypes.NameIdentifier,
            List<string>? calls = null,
            long? organizationId = 17)
    {
        var listings = new Mock<IListingService>();
        listings.Setup(service => service.PublishListing(17))
            .Callback(() => calls?.Add("publish"))
            .ReturnsAsync(ServiceResponse<LoadListingDto>.CreateSuccess(new LoadListingDto()));

        var readiness = new Mock<IFeatureReadinessService>();
        var setup = readiness.Setup(service => service.GetAsync(42, organizationId, FeatureKeys.ListingSyndication))
            .Callback(() => calls?.Add("readiness"));
        if (readinessThrows)
            setup.ThrowsAsync(new InvalidOperationException("readiness unavailable"));
        else
            setup.ReturnsAsync(Readiness(canInvoke));

        var claims = userId.HasValue ? new[] { new Claim(claimType, userId.Value.ToString()) } : [];
        var controller = new ListingController(listings.Object, Mock.Of<IListingAIService>(), readiness.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
                },
            },
        };
        if (organizationId.HasValue)
            controller.HttpContext.Items["OrganizationId"] = organizationId.Value;

        return (controller, listings, readiness);
    }

    private static FeatureReadinessDto Readiness(bool canInvoke) => new(
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
