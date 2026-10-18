using brownstone_hub_api;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.VendorService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Text.Json;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class VendorControllerTests
{
    [Fact]
    public async Task List_IgnoresLegacyCallerLandlordId_AndUsesAuthenticatedOrganization()
    {
        var vendors = new Mock<IVendorService>();
        vendors.Setup(x => x.GetVendorsByOrganizationId(60, false))
            .ReturnsAsync(ServiceResponse<List<LoadVendorDto>>.CreateSuccess([], "ok"));
        var controller = Controller(vendors, 60);

        (await controller.GetVendors(999, false)).Should().BeOfType<OkObjectResult>();

        vendors.Verify(x => x.GetVendorsByOrganizationId(60, false), Times.Once);
        vendors.Verify(x => x.GetVendorsByLandlordId(It.IsAny<long>(), It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task DetailAndSearch_AreOrganizationScoped_AndMissingContextIsForbidden()
    {
        var vendors = new Mock<IVendorService>();
        vendors.Setup(x => x.GetVendorByOrganizationId(42, 60))
            .ReturnsAsync(ServiceResponse<LoadVendorDto>.CreateSuccess(new(), "ok"));
        vendors.Setup(x => x.SearchVendorsByOrganizationId(60, "plumb", "Plumber"))
            .ReturnsAsync(ServiceResponse<List<LoadVendorDto>>.CreateSuccess([], "ok"));
        var scoped = Controller(vendors, 60);

        (await scoped.GetVendorById(42)).Should().BeOfType<OkObjectResult>();
        (await scoped.SearchVendors(999, "plumb", "Plumber")).Should().BeOfType<OkObjectResult>();
        (await Controller(vendors, null).GetVendorById(42)).Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);

        vendors.Verify(x => x.GetVendorByOrganizationId(42, 60), Times.Once);
        vendors.Verify(x => x.SearchVendorsByOrganizationId(60, "plumb", "Plumber"), Times.Once);
        vendors.Verify(x => x.GetVendorById(It.IsAny<long>()), Times.Never);
        vendors.Verify(x => x.SearchVendors(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string?>()), Times.Never);
    }

    [Fact]
    public async Task ProfilePatchAndMaintenance_RequireOrganizationContext()
    {
        var vendors = new Mock<IVendorService>();
        using var document = JsonDocument.Parse("{\"name\":\"New name\"}");
        var changes = document.RootElement;
        vendors.Setup(x => x.PatchVendor(42, 60, It.IsAny<JsonElement>()))
            .ReturnsAsync(ServiceResponse<LoadVendorDto>.CreateSuccess(new(), "ok"));
        vendors.Setup(x => x.GetVendorMaintenance(42, 60))
            .ReturnsAsync(ServiceResponse<List<VendorMaintenanceDto>>.CreateSuccess([], "ok"));

        (await Controller(vendors, 60).PatchVendor(42, changes)).Should().BeOfType<OkObjectResult>();
        (await Controller(vendors, 60).GetVendorMaintenance(42)).Should().BeOfType<OkObjectResult>();
        (await Controller(vendors, null).PatchVendor(42, changes)).Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        (await Controller(vendors, null).GetVendorMaintenance(42)).Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        vendors.Verify(x => x.PatchVendor(42, 60, It.IsAny<JsonElement>()), Times.Once);
        vendors.Verify(x => x.GetVendorMaintenance(42, 60), Times.Once);
    }

    private static VendorController Controller(Mock<IVendorService> vendors, long? organizationId)
    {
        var controller = new VendorController(vendors.Object, new Mock<IUserService>().Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        if (organizationId.HasValue) controller.HttpContext.Items["OrganizationId"] = organizationId.Value;
        return controller;
    }
}
