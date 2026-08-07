using Azure.Storage.Blobs;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.BackgroundCheck;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Services.ApplicationService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.BackgroundCheckService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public class ScreeningOwnershipTests
{
    [Fact]
    public async Task RequestBackgroundCheck_DeniesCrossLandlord_BeforeProviderOrPiiEntityAccess()
    {
        var (controller, backgroundChecks, applications) = CreateController(applicationLandlordId: 99, currentUserId: 42);

        var result = await controller.RequestBackgroundCheck(7, new RequestBackgroundCheckDto
        {
            ApplicationId = 7,
            ScreeningPackage = "full"
        });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        backgroundChecks.Verify(service => service.RequestBackgroundCheckAsync(It.IsAny<long>(), It.IsAny<string>()), Times.Never);
        applications.Verify(repository => repository.GetApplicationById(It.IsAny<long>()), Times.Never);
        applications.Verify(repository => repository.GetApplicationEntityById(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task GetBackgroundCheckStatus_DeniesCrossLandlord_BeforeProviderAccess()
    {
        var (controller, backgroundChecks, _) = CreateController(applicationLandlordId: 99, currentUserId: 42);

        var result = await controller.GetBackgroundCheckStatus(7);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        backgroundChecks.Verify(service => service.GetBackgroundCheckStatusAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task RequestBackgroundCheck_DeniesSameLandlordCrossOrganization_BeforeProviderAccess()
    {
        var (controller, backgroundChecks, _) = CreateController(
            applicationLandlordId: 42,
            currentUserId: 42,
            applicationOrganizationId: 20,
            currentOrganizationId: 10);

        var result = await controller.RequestBackgroundCheck(7, new RequestBackgroundCheckDto
        {
            ApplicationId = 7,
            ScreeningPackage = "full"
        });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        backgroundChecks.Verify(service => service.RequestBackgroundCheckAsync(It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetBackgroundCheckStatus_DeniesSameLandlordCrossOrganization_BeforeProviderAccess()
    {
        var (controller, backgroundChecks, _) = CreateController(
            applicationLandlordId: 42,
            currentUserId: 42,
            applicationOrganizationId: 20,
            currentOrganizationId: 10);

        var result = await controller.GetBackgroundCheckStatus(7);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        backgroundChecks.Verify(service => service.GetBackgroundCheckStatusAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task RequestBackgroundCheck_AuthorizedLegacyPathReturnsGoneWithoutProviderCall()
    {
        var (controller, backgroundChecks, _) = CreateController(applicationLandlordId: 42, currentUserId: 42);

        var result = await controller.RequestBackgroundCheck(7, new RequestBackgroundCheckDto
        {
            ApplicationId = 7,
            ScreeningPackage = "full"
        });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status410Gone);
        backgroundChecks.Verify(service => service.RequestBackgroundCheckAsync(It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetBackgroundCheckStatus_AuthorizedLegacyPathReturnsGoneWithoutProviderCall()
    {
        var (controller, backgroundChecks, _) = CreateController(applicationLandlordId: 42, currentUserId: 42);

        var result = await controller.GetBackgroundCheckStatus(7);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status410Gone);
        backgroundChecks.Verify(service => service.GetBackgroundCheckStatusAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task RequestBackgroundCheck_DeniesWhenCurrentUserCannotBeResolved()
    {
        var applications = new Mock<IApplicationRepository>();
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetCurrentUser()).ReturnsAsync((LoadUserDto)null!);
        var backgroundChecks = new Mock<IBackgroundCheckService>();
        var controller = CreateController(applications, users, backgroundChecks);

        var result = await controller.RequestBackgroundCheck(7, new RequestBackgroundCheckDto { ApplicationId = 7 });

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        backgroundChecks.Verify(service => service.RequestBackgroundCheckAsync(It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    private static (ApplicationController Controller, Mock<IBackgroundCheckService> BackgroundChecks,
        Mock<IApplicationRepository> Applications) CreateController(
            long applicationLandlordId,
            long currentUserId,
            long applicationOrganizationId = 10,
            long currentOrganizationId = 10)
    {
        var applications = new Mock<IApplicationRepository>();
        applications.Setup(repository => repository.IsApplicationOwnedByLandlordAndOrganization(
                7, currentUserId, currentOrganizationId))
            .ReturnsAsync(applicationLandlordId == currentUserId && applicationOrganizationId == currentOrganizationId);
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetCurrentUser())
            .ReturnsAsync(new LoadUserDto { Id = currentUserId });
        var backgroundChecks = new Mock<IBackgroundCheckService>();
        var success = ServiceResponse<BackgroundCheckResultDto>.CreateSuccess(new BackgroundCheckResultDto());
        backgroundChecks.Setup(service => service.RequestBackgroundCheckAsync(It.IsAny<long>(), It.IsAny<string>()))
            .ReturnsAsync(success);
        backgroundChecks.Setup(service => service.GetBackgroundCheckStatusAsync(It.IsAny<long>()))
            .ReturnsAsync(success);

        var controller = CreateController(applications, users, backgroundChecks);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.HttpContext.Items["OrganizationId"] = currentOrganizationId;
        return (controller, backgroundChecks, applications);
    }

    private static ApplicationController CreateController(
        Mock<IApplicationRepository> applications,
        Mock<IUserRepository> users,
        Mock<IBackgroundCheckService> backgroundChecks) =>
        new(
            Mock.Of<IApplicationService>(),
            Mock.Of<IApplicationPdfService>(),
            applications.Object,
            users.Object,
            new BlobServiceClient(new Uri("https://example.invalid")),
            Mock.Of<IAzureBlobService>(),
            backgroundChecks.Object);
}
