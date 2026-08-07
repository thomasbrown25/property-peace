using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
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

public sealed class ListingTenantScreeningWriteProtectionTests
{
    [Fact]
    public async Task CreateListing_ClearsTenantScreeningConfiguration_WhenReadinessIsBlocked()
    {
        var (controller, listings, _) = CreateController(screeningCanInvoke: false);
        var dto = ScreeningCreateDto();

        await controller.CreateListing(dto, null);

        AssertScreeningCleared(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.CreateListing(dto, null), Times.Once);
    }

    [Fact]
    public async Task UpdateListing_ClearsTenantScreeningConfiguration_WhenReadinessIsBlocked()
    {
        var (controller, listings, _) = CreateController(screeningCanInvoke: false);
        var dto = ScreeningUpdateDto();

        await controller.UpdateListing(11, dto);

        dto.Id.Should().Be(11);
        AssertScreeningCleared(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.UpdateListing(dto), Times.Once);
    }

    [Fact]
    public async Task CreateListing_PreservesTenantScreeningConfiguration_WhenReadinessAllowsInvocation()
    {
        var (controller, listings, _) = CreateController(screeningCanInvoke: true);
        var dto = ScreeningCreateDto();

        await controller.CreateListing(dto, null);

        AssertScreeningPreserved(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.CreateListing(dto, null), Times.Once);
    }

    [Fact]
    public async Task UpdateListing_PreservesTenantScreeningConfiguration_WhenReadinessAllowsInvocation()
    {
        var (controller, listings, _) = CreateController(screeningCanInvoke: true);
        var dto = ScreeningUpdateDto();

        await controller.UpdateListing(11, dto);

        AssertScreeningPreserved(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.UpdateListing(dto), Times.Once);
    }

    [Fact]
    public async Task CreateListing_ClearsTenantScreeningConfiguration_AndStillCreates_WhenIdentityIsMissing()
    {
        var (controller, listings, readiness) = CreateController(screeningCanInvoke: true, userId: null);
        var dto = ScreeningCreateDto();

        await controller.CreateListing(dto, null);

        AssertScreeningCleared(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.CreateListing(dto, null), Times.Once);
        readiness.Verify(service => service.GetAsync(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task UpdateListing_ClearsTenantScreeningConfiguration_AndStillUpdates_WhenReadinessThrows()
    {
        var (controller, listings, _) = CreateController(screeningCanInvoke: true, screeningThrows: true);
        var dto = ScreeningUpdateDto();

        var action = async () => await controller.UpdateListing(11, dto);

        await action.Should().NotThrowAsync();
        AssertScreeningCleared(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        listings.Verify(service => service.UpdateListing(dto), Times.Once);
    }

    [Theory]
    [InlineData("userId")]
    [InlineData("sub")]
    public async Task CreateListing_UsesSupportedFallbackIdentityClaims(string claimType)
    {
        var (controller, listings, readiness) = CreateController(
            screeningCanInvoke: true,
            identityClaimType: claimType);
        var dto = ScreeningCreateDto();

        await controller.CreateListing(dto, null);

        AssertScreeningPreserved(dto.RequireScreening, dto.ScreeningType,
            dto.RequireIncomeVerification, dto.IncomeVerificationCost);
        readiness.Verify(service => service.GetAsync(42, 17, FeatureKeys.TenantScreening), Times.Once);
        listings.Verify(service => service.CreateListing(dto, null), Times.Once);
    }

    private static CreateListingDto ScreeningCreateDto() => new()
    {
        PropertyId = 7,
        RequireScreening = true,
        ScreeningType = EScreeningType.Premium,
        RequireIncomeVerification = true,
        IncomeVerificationCost = 24.95m,
    };

    private static UpdateListingDto ScreeningUpdateDto() => new()
    {
        RequireScreening = true,
        ScreeningType = EScreeningType.Premium,
        RequireIncomeVerification = true,
        IncomeVerificationCost = 24.95m,
    };

    private static void AssertScreeningCleared(
        bool? requireScreening,
        EScreeningType? screeningType,
        bool? requireIncomeVerification,
        decimal? incomeVerificationCost)
    {
        requireScreening.Should().BeFalse();
        screeningType.Should().BeNull();
        requireIncomeVerification.Should().BeFalse();
        incomeVerificationCost.Should().Be(0m);
    }

    private static void AssertScreeningPreserved(
        bool? requireScreening,
        EScreeningType? screeningType,
        bool? requireIncomeVerification,
        decimal? incomeVerificationCost)
    {
        requireScreening.Should().BeTrue();
        screeningType.Should().Be(EScreeningType.Premium);
        requireIncomeVerification.Should().BeTrue();
        incomeVerificationCost.Should().Be(24.95m);
    }

    private static (
        ListingController Controller,
        Mock<IListingService> Listings,
        Mock<IFeatureReadinessService> Readiness) CreateController(
            bool screeningCanInvoke,
            long? userId = 42,
            bool screeningThrows = false,
            string identityClaimType = ClaimTypes.NameIdentifier)
    {
        var listings = new Mock<IListingService>();
        listings.Setup(service => service.CreateListing(It.IsAny<CreateListingDto>(), It.IsAny<List<IFormFile>>()))
            .ReturnsAsync(new ServiceResponse<LoadListingDto>());
        listings.Setup(service => service.UpdateListing(It.IsAny<UpdateListingDto>()))
            .ReturnsAsync(new ServiceResponse<LoadListingDto>());

        var readiness = new Mock<IFeatureReadinessService>();
        readiness.Setup(service => service.GetAsync(42, 17, FeatureKeys.ListingSyndication))
            .ReturnsAsync(Readiness(FeatureKeys.ListingSyndication, canInvoke: true));
        if (screeningThrows)
        {
            readiness.Setup(service => service.GetAsync(42, 17, FeatureKeys.TenantScreening))
                .ThrowsAsync(new InvalidOperationException("readiness unavailable"));
        }
        else
        {
            readiness.Setup(service => service.GetAsync(42, 17, FeatureKeys.TenantScreening))
                .ReturnsAsync(Readiness(FeatureKeys.TenantScreening, screeningCanInvoke));
        }

        var claims = userId.HasValue
            ? new[] { new Claim(identityClaimType, userId.Value.ToString()) }
            : [];
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
        controller.HttpContext.Items["OrganizationId"] = 17L;

        return (controller, listings, readiness);
    }

    private static FeatureReadinessDto Readiness(string feature, bool canInvoke) => new(
        feature,
        canInvoke ? FeatureReadinessState.Available : FeatureReadinessState.ComingSoon,
        canInvoke,
        true,
        canInvoke,
        true,
        canInvoke,
        true,
        canInvoke ? [] : ["GlobalGate"]);
}
