using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.LeaseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public class LeaseByIdControllerTests
{
    [Fact]
    public async Task GetLeaseById_ReturnsExactLeaseWithoutUsingUnitLookup()
    {
        const long leaseId = 4_294_967_300;
        var response = ServiceResponse<LoadLeaseDto>.CreateSuccess(new LoadLeaseDto
        {
            Id = leaseId,
            UnitId = 17
        });
        var service = new Mock<ILeaseService>(MockBehavior.Strict);
        service.Setup(x => x.GetLeaseById(leaseId)).ReturnsAsync(response);

        var result = Assert.IsType<OkObjectResult>(await CreateController(service.Object).GetLeaseById(leaseId));

        Assert.Equal(200, result.StatusCode);
        Assert.Same(response, result.Value);
        service.Verify(x => x.GetLeaseById(leaseId), Times.Once);
        service.Verify(x => x.GetLease(It.IsAny<long>()), Times.Never);
        service.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(404, "Lease not found", "No lease found with ID 42")]
    [InlineData(404, "Lease not found", "The lease does not belong to your organization")]
    [InlineData(400, "Organization ID is required", "No organization context found")]
    [InlineData(403, "Organization access denied", "You do not have permission for this organization")]
    public async Task GetLeaseById_PreservesServiceFailureStatusMessageAndErrors(int statusCode, string message, string details)
    {
        const long leaseId = 42;
        var response = ServiceResponse<LoadLeaseDto>.CreateError(message, details, statusCode: statusCode);
        var service = new Mock<ILeaseService>(MockBehavior.Strict);
        service.Setup(x => x.GetLeaseById(leaseId)).ReturnsAsync(response);

        var result = Assert.IsType<ObjectResult>(await CreateController(service.Object).GetLeaseById(leaseId));

        Assert.Equal(statusCode, result.StatusCode);
        Assert.NotNull(result.Value);
        Assert.Equal(response.Message, result.Value.GetType().GetProperty("Message")!.GetValue(result.Value));
        Assert.Same(response.Errors, result.Value.GetType().GetProperty("Errors")!.GetValue(result.Value));
        service.Verify(x => x.GetLeaseById(leaseId), Times.Once);
        service.Verify(x => x.GetLease(It.IsAny<long>()), Times.Never);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetLease_KeepsExistingUnitScopedLookup()
    {
        const long unitId = 17;
        var response = ServiceResponse<LoadLeaseDto>.CreateSuccess(new LoadLeaseDto { Id = 42, UnitId = unitId });
        var service = new Mock<ILeaseService>(MockBehavior.Strict);
        service.Setup(x => x.GetLease(unitId)).ReturnsAsync(response);

        var result = Assert.IsType<OkObjectResult>(await CreateController(service.Object).GetLease(unitId));

        Assert.Same(response, result.Value);
        service.Verify(x => x.GetLease(unitId), Times.Once);
        service.Verify(x => x.GetLeaseById(It.IsAny<long>()), Times.Never);
        service.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(nameof(LeaseController.GetLeaseById), "by-id/{leaseId:long}")]
    [InlineData(nameof(LeaseController.GetLease), "{unitId}")]
    public void LeaseGetActions_KeepDistinctRoutesAndLandlordAdminAuthorization(string actionName, string route)
    {
        var method = typeof(LeaseController).GetMethod(actionName)!;

        Assert.Equal(route, Assert.Single(method.GetCustomAttributes<HttpGetAttribute>()).Template);
        Assert.Equal("Landlord,Admin", Assert.Single(method.GetCustomAttributes<AuthorizeAttribute>()).Roles);
        Assert.Empty(method.GetCustomAttributes<AllowAnonymousAttribute>());
    }

    private static LeaseController CreateController(ILeaseService service) =>
        new(service, null!, null!, null!, null!, null!, null!, null!, null!, null!, null!);
}
