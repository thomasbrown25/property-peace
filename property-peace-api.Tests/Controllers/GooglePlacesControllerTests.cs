using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.GooglePlaces;
using brownstone_hub_api.Services.GooglePlacesService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class GooglePlacesControllerTests
{
    [Fact]
    public void Contract_IsLandlordAdminOnly_AndUsesNarrowRoutes()
    {
        var type = typeof(GooglePlacesController);
        type.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/google-places");
        type.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
        type.GetMethod(nameof(GooglePlacesController.Autocomplete))!
            .GetCustomAttribute<HttpPostAttribute>()!.Template.Should().Be("autocomplete");
        type.GetMethod(nameof(GooglePlacesController.Details))!
            .GetCustomAttribute<HttpGetAttribute>()!.Template.Should().Be("details/{placeId}");
    }

    [Fact]
    public async Task Autocomplete_ShortInputReturnsEmptyWithoutCallingService()
    {
        var service = new Mock<IGooglePlacesService>();
        var controller = Create(service.Object);

        var result = await controller.Autocomplete(
            new GooglePlacesController.AutocompleteWireRequest("ab", Guid.NewGuid().ToString()),
            CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Autocomplete_InvalidRequestReturnsSafe400WithoutCallingService()
    {
        var service = new Mock<IGooglePlacesService>();

        var result = await Create(service.Object).Autocomplete(
            new GooglePlacesController.AutocompleteWireRequest(new string('a', 201), Guid.NewGuid().ToString()),
            CancellationToken.None);

        var response = result.Should().BeOfType<BadRequestObjectResult>().Which.Value
            .Should().BeOfType<brownstone_hub_api.Models.ServiceResponse<GooglePlacesAutocompleteResponse>>().Which;
        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(400);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Details_InvalidPlaceIdReturnsSafe400WithoutCallingService()
    {
        var service = new Mock<IGooglePlacesService>();

        var result = await Create(service.Object).Details("place\\id", Guid.NewGuid().ToString(), CancellationToken.None);

        var response = result.Should().BeOfType<BadRequestObjectResult>().Which.Value
            .Should().BeOfType<brownstone_hub_api.Models.ServiceResponse<GooglePlaceDetailsDto>>().Which;
        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(400);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Details_NotConfiguredMapsToSafe503()
    {
        var service = new Mock<IGooglePlacesService>();
        service.Setup(value => value.GetDetailsAsync(
                "place-123", It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new GooglePlacesException(
                GooglePlacesFailureKind.NotConfigured,
                "Address suggestions are unavailable."));

        var result = await Create(service.Object).Details(
            "place-123", Guid.NewGuid().ToString(), CancellationToken.None);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(503);
    }

    [Theory]
    [InlineData(GooglePlacesFailureKind.Upstream, 502)]
    [InlineData(GooglePlacesFailureKind.InvalidResponse, 502)]
    [InlineData(GooglePlacesFailureKind.Timeout, 504)]
    public async Task Details_ProviderFailureMapsToSafeStatus(GooglePlacesFailureKind kind, int status)
    {
        var service = new Mock<IGooglePlacesService>();
        service.Setup(value => value.GetDetailsAsync(
                "place-123", It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new GooglePlacesException(kind, "upstream detail that must not leak"));

        var result = await Create(service.Object).Details("place-123", Guid.NewGuid().ToString(), CancellationToken.None);

        var response = result.Should().BeOfType<ObjectResult>().Which;
        response.StatusCode.Should().Be(status);
        response.Value.Should().BeOfType<brownstone_hub_api.Models.ServiceResponse<GooglePlaceDetailsDto>>()
            .Which.Message.Should().Be("Address suggestions are unavailable. Continue entering it manually.");
    }

    [Fact]
    public async Task StreetView_RequiresAddressAndOnlyReturnsVerifiedImage()
    {
        var service = new Mock<IGooglePlacesService>();
        var controller = Create(service.Object);
        (await controller.StreetView(" ", CancellationToken.None)).Should().BeOfType<BadRequestObjectResult>();
        service.VerifyNoOtherCalls();

        service.Setup(value => value.GetStreetViewImageAsync("123 Main St", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 1, 2, 3 });
        var result = await controller.StreetView(" 123 Main St ", CancellationToken.None);
        result.Should().BeOfType<OkObjectResult>().Which.Value
            .Should().BeOfType<brownstone_hub_api.Models.ServiceResponse<string>>().Which.Data
            .Should().Be(Convert.ToBase64String(new byte[] { 1, 2, 3 }));
        service.Setup(value => value.GetStreetViewImageAsync("unknown", It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);
        (await controller.StreetView("unknown", CancellationToken.None)).Should().BeOfType<NotFoundResult>();
    }

    private static GooglePlacesController Create(IGooglePlacesService service) =>
        new(service, NullLogger<GooglePlacesController>.Instance);
}
