using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Services.ApplicationService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.Timelines;
using brownstone_hub_api.Services.UserContextService;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Listings;

public sealed class ShortTermListingGuardTests
{
    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Create_listing_respects_unit_mode(ERentalMode mode, bool allowed)
    {
        var f = new Fixture(mode);
        f.Properties.Setup(x => x.GetPropertyById(7)).ReturnsAsync(new LoadPropertyDto { Id = 7, OrganizationId = 20 });
        f.Listings.Setup(x => x.CreateListing(It.IsAny<CreateListingDto>(), 20, 42))
            .ReturnsAsync(f.Listing);
        var result = await f.ListingService.CreateListing(new CreateListingDto { PropertyId = 7, UnitId = 10 }, null);
        Assert.Equal(allowed, result.Success);
        f.Listings.Verify(x => x.CreateListing(It.IsAny<CreateListingDto>(), It.IsAny<long>(), It.IsAny<long>()),
            allowed ? Times.Once : Times.Never);
    }

    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Update_and_publish_respect_unit_mode(ERentalMode mode, bool allowed)
    {
        var f = new Fixture(mode);
        var update = new UpdateListingDto { Id = 17, Status = EListingStatus.Active };
        f.Listings.Setup(x => x.UpdateListing(It.IsAny<UpdateListingDto>())).ReturnsAsync(f.Listing);
        var updated = await f.ListingService.UpdateListing(update);
        var published = await f.ListingService.PublishListing(17);
        Assert.Equal(allowed, updated.Success);
        Assert.Equal(allowed, published.Success);
        f.Listings.Verify(x => x.UpdateListing(It.IsAny<UpdateListingDto>()), allowed ? Times.Exactly(2) : Times.Never());
    }

    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Guest_application_respects_listing_unit_mode(ERentalMode mode, bool allowed)
    {
        var f = new Fixture(mode);
        f.Listing.AcceptOnlineApplications = true;
        f.Listings.Setup(x => x.GetListingByNumber("L17")).ReturnsAsync(f.Listing);
        f.Applications.Setup(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), 42, 20))
            .ReturnsAsync(new LoadRentalApplicationDto { Id = 5 });
        var result = await f.ApplicationService.SubmitPublicApplicationAsync(new PublicApplicationSubmitDto { ListingNumber = "L17" });
        Assert.Equal(allowed, result.Success);
        f.Applications.Verify(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), It.IsAny<long>(), It.IsAny<long?>()),
            allowed ? Times.Once : Times.Never);
    }

    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Property_only_listing_create_update_publish_respect_mode(ERentalMode mode, bool allowed)
    {
        var f = new Fixture(mode);
        f.Listing.UnitId = null;
        f.Properties.Setup(x => x.GetPropertyById(7)).ReturnsAsync(new LoadPropertyDto { Id = 7, OrganizationId = 20 });
        f.Listings.Setup(x => x.CreateListing(It.IsAny<CreateListingDto>(), 20, 42)).ReturnsAsync(f.Listing);
        f.Listings.Setup(x => x.UpdateListing(It.IsAny<UpdateListingDto>())).ReturnsAsync(f.Listing);
        Assert.Equal(allowed, (await f.ListingService.CreateListing(new CreateListingDto { PropertyId = 7 }, null)).Success);
        Assert.Equal(allowed, (await f.ListingService.UpdateListing(new UpdateListingDto { Id = 17, Status = EListingStatus.Active })).Success);
        Assert.Equal(allowed, (await f.ListingService.PublishListing(17)).Success);
        f.Listings.Verify(x => x.CreateListing(It.IsAny<CreateListingDto>(), It.IsAny<long>(), It.IsAny<long>()), allowed ? Times.Once : Times.Never);
        f.Listings.Verify(x => x.UpdateListing(It.IsAny<UpdateListingDto>()), allowed ? Times.Exactly(2) : Times.Never());
    }

    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Direct_application_create_respects_unit_mode(ERentalMode mode, bool allowed)
    {
        var f = new Fixture(mode);
        f.Applications.Setup(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), 42, 20))
            .ReturnsAsync(new LoadRentalApplicationDto { Id = 5 });
        Assert.Equal(allowed, (await f.ApplicationService.AddApplication(new AddRentalApplicationDto { PropertyId = 7, UnitId = 10 })).Success);
        f.Applications.Verify(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), It.IsAny<long>(), It.IsAny<long?>()), allowed ? Times.Once : Times.Never);
    }

    [Fact]
    public async Task Property_only_public_application_rejects_short_term_property()
    {
        var f = new Fixture(ERentalMode.ShortTerm);
        f.Listing.UnitId = null;
        f.Listing.AcceptOnlineApplications = true;
        f.Listings.Setup(x => x.GetListingByNumber("L17")).ReturnsAsync(f.Listing);
        Assert.False((await f.ApplicationService.SubmitPublicApplicationAsync(new PublicApplicationSubmitDto { ListingNumber = "L17" })).Success);
        f.Applications.Verify(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), It.IsAny<long>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task Mixed_property_cannot_create_property_wide_listing_or_application()
    {
        var f = new Fixture(ERentalMode.LongTerm);
        f.Listing.UnitId = null;
        f.Units.Setup(x => x.GetUnits(7, It.IsAny<long?>())).ReturnsAsync([
            new LoadUnitDto { Id = 10, PropertyId = 7, RentalMode = ERentalMode.LongTerm },
            new LoadUnitDto { Id = 11, PropertyId = 7, RentalMode = ERentalMode.ShortTerm }
        ]);
        f.Properties.Setup(x => x.GetPropertyById(7)).ReturnsAsync(new LoadPropertyDto { Id = 7, OrganizationId = 20 });
        Assert.Equal(409, (await f.ListingService.CreateListing(new CreateListingDto { PropertyId = 7 }, null)).StatusCode);
        Assert.Equal(409, (await f.ApplicationService.AddApplication(new AddRentalApplicationDto { PropertyId = 7 })).StatusCode);
        f.Listings.Verify(x => x.CreateListing(It.IsAny<CreateListingDto>(), It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        f.Applications.Verify(x => x.AddApplication(It.IsAny<AddRentalApplicationDto>(), It.IsAny<long>(), It.IsAny<long?>()), Times.Never);
    }

    private sealed class Fixture
    {
        public Mock<IListingRepository> Listings { get; } = new();
        public Mock<IPropertyRepository> Properties { get; } = new();
        public Mock<IApplicationRepository> Applications { get; } = new();
        public Mock<IUserRepository> Users { get; } = new();
        public Mock<IUnitRepository> Units { get; } = new();
        public LoadListingDto Listing { get; } = new() { Id = 17, PropertyId = 7, UnitId = 10, OrganizationId = 20,
            CreatedBy = 42, ListingNumber = "L17", PropertyAddress = "17 Main Street", Status = EListingStatus.Draft };
        public ListingService ListingService { get; }
        public ApplicationService ApplicationService { get; }

        public Fixture(ERentalMode mode)
        {
            Units.Setup(x => x.GetUnitById(10, It.IsAny<long?>())).ReturnsAsync(new LoadUnitDto { Id = 10, PropertyId = 7, RentalMode = mode });
            Units.Setup(x => x.GetUnits(7, It.IsAny<long?>())).ReturnsAsync([new LoadUnitDto { Id = 10, PropertyId = 7, RentalMode = mode }]);
            Users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new brownstone_hub_api.Dtos.User.LoadUserDto { Id = 42 });
            Listings.Setup(x => x.GetListingById(17)).ReturnsAsync(Listing);
            var members = new Mock<IOrganizationMemberRepository>();
            members.Setup(x => x.GetMemberAsync(20, 42)).ReturnsAsync(new OrganizationMember
                { OrganizationId = 20, UserId = 42, IsActive = true, Role = "Owner" });
            var user = new Mock<IUserContextService>();
            user.Setup(x => x.GetCurrentUserIdAsync()).ReturnsAsync(42L);
            var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
            http.HttpContext.Items["OrganizationId"] = 20L;
            var blob = new BlobServiceClient(new Uri("https://example.invalid"));
            ListingService = new ListingService(Listings.Object, members.Object, Properties.Object, Units.Object,
                Mock.Of<IImageService<ListingImage, LoadImageDto, AddImageDto>>(), Mock.Of<IAzureBlobService>(), blob,
                user.Object, http, NullLogger<ListingService>.Instance);
            ApplicationService = new ApplicationService(Applications.Object, Users.Object,
                Mock.Of<IApplicationPdfService>(), blob, Mock.Of<IAzureBlobService>(), Mock.Of<INotificationService>(),
                http, Listings.Object, NullLogger<ApplicationService>.Instance, Mock.Of<IWorkflowTimelineIntegration>(),
                dataContext: null, unitRepository: Units.Object);
        }
    }
}
