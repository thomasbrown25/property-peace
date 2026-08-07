using System.Reflection;
using Azure.Storage.Blobs;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.UserContextService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class ListingNumericRetrievalSecurityTests
{
    [Fact]
    public void GetListingById_RequiresAuthentication()
    {
        var action = typeof(ListingController).GetMethod(
            nameof(ListingController.GetListingById),
            BindingFlags.Instance | BindingFlags.Public);

        action.Should().NotBeNull();
        action!.GetCustomAttribute<AllowAnonymousAttribute>().Should().BeNull();
        typeof(ListingController).GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull();
    }

    [Theory]
    [InlineData(nameof(ListingController.GetPublicListings))]
    [InlineData(nameof(ListingController.GetPublicListing))]
    [InlineData(nameof(ListingController.GetPublicListingBySlug))]
    public void DedicatedPublicListingEndpoints_RemainAnonymous(string actionName)
    {
        var action = typeof(ListingController).GetMethod(
            actionName,
            BindingFlags.Instance | BindingFlags.Public);

        action.Should().NotBeNull();
        action!.GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
    }

    [Fact]
    public async Task GetListingById_DeniesAnonymousDraftWithoutLoadingIt()
    {
        var fixture = CreateFixture(
            currentOrganizationId: null,
            currentUserId: null,
            listingOrganizationId: 101,
            listingStatus: EListingStatus.Draft);

        var response = await fixture.Service.GetListingById(17);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Listings.Verify(repository => repository.GetListingById(It.IsAny<long>()), Times.Never);
        fixture.Images.Verify(service => service.GetImagesByRefId(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task GetListingById_DeniesAuthenticatedMemberFromAnotherOrganization()
    {
        var fixture = CreateFixture(
            currentOrganizationId: 202,
            currentUserId: 42,
            listingOrganizationId: 101,
            listingStatus: EListingStatus.Draft);

        var response = await fixture.Service.GetListingById(17);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        fixture.Members.Verify(repository => repository.GetMemberAsync(202, 42), Times.Once);
        fixture.Images.Verify(service => service.GetImagesByRefId(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task GetListingById_ReturnsDraftForAuthenticatedActiveMemberOfCanonicalOrganization()
    {
        var fixture = CreateFixture(
            currentOrganizationId: 101,
            currentUserId: 42,
            listingOrganizationId: 101,
            listingStatus: EListingStatus.Draft);

        var response = await fixture.Service.GetListingById(17);

        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.Id.Should().Be(17);
        response.Data.Status.Should().Be(EListingStatus.Draft);
        fixture.Members.Verify(repository => repository.GetMemberAsync(101, 42), Times.Once);
        fixture.Images.Verify(service => service.GetImagesByRefId(17), Times.Once);
    }

    private static Fixture CreateFixture(
        long? currentOrganizationId,
        long? currentUserId,
        long listingOrganizationId,
        EListingStatus listingStatus)
    {
        var listings = new Mock<IListingRepository>();
        listings.Setup(repository => repository.GetListingById(17))
            .ReturnsAsync(new LoadListingDto
            {
                Id = 17,
                OrganizationId = listingOrganizationId,
                Status = listingStatus,
            });

        var members = new Mock<IOrganizationMemberRepository>();
        if (currentOrganizationId.HasValue && currentUserId.HasValue)
        {
            members.Setup(repository => repository.GetMemberAsync(currentOrganizationId.Value, currentUserId.Value))
                .ReturnsAsync(new OrganizationMember
                {
                    OrganizationId = currentOrganizationId.Value,
                    UserId = currentUserId.Value,
                    IsActive = true,
                    Role = "Viewer",
                });
        }

        var images = new Mock<IImageService<ListingImage, LoadImageDto, AddImageDto>>();
        images.Setup(service => service.GetImagesByRefId(It.IsAny<long>()))
            .ReturnsAsync(ServiceResponse<List<LoadImageDto>>.CreateSuccess([]));

        var userContext = new Mock<IUserContextService>();
        userContext.Setup(service => service.GetCurrentUserIdAsync()).ReturnsAsync(currentUserId);

        var httpContext = new DefaultHttpContext();
        if (currentOrganizationId.HasValue)
            httpContext.Items["OrganizationId"] = currentOrganizationId.Value;

        var service = new ListingService(
            listings.Object,
            members.Object,
            Mock.Of<IPropertyRepository>(),
            Mock.Of<IUnitRepository>(),
            images.Object,
            Mock.Of<IAzureBlobService>(),
            new BlobServiceClient(new Uri("https://example.invalid")),
            userContext.Object,
            new HttpContextAccessor { HttpContext = httpContext },
            NullLogger<ListingService>.Instance);

        return new Fixture(service, listings, members, images);
    }

    private sealed record Fixture(
        ListingService Service,
        Mock<IListingRepository> Listings,
        Mock<IOrganizationMemberRepository> Members,
        Mock<IImageService<ListingImage, LoadImageDto, AddImageDto>> Images);
}
