using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class RentPaymentAccessControllerTests
{
    private const long UserId = 42;
    private const long OrganizationId = 71;

    [Theory]
    [InlineData("Owner")]
    [InlineData("Manager")]
    public async Task GetAndRequest_ActiveOwnerOrManager_UsesTrustedOrganizationContext(string role)
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var authority = ActiveAuthority(role);
        var current = new RentPaymentAccessDto(Guid.NewGuid(), (int)OrganizationId, "Pending", DateTime.UtcNow, null, null);
        service.Setup(candidate => candidate.GetForOrganizationAsync((int)OrganizationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(current);
        service.Setup(candidate => candidate.RequestAsync((int)OrganizationId, (int)UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(current);
        var controller = CreateController(service.Object, authority.Object);

        var getResult = await controller.Get(CancellationToken.None);
        var requestResult = await controller.Request(CancellationToken.None);

        Assert.IsType<OkObjectResult>(getResult.Result);
        Assert.IsType<OkObjectResult>(requestResult.Result);
        service.VerifyAll();
    }

    [Theory]
    [InlineData("Viewer")]
    [InlineData(null)]
    public async Task Get_TenantOrInactiveMembership_IsForbidden(string? role)
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var authority = new Mock<IOrganizationAuthorityResolver>(MockBehavior.Strict);
        authority.Setup(candidate => candidate.ResolveActiveMemberAsync(UserId, OrganizationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(role is null ? null : new OrganizationMember { UserId = UserId, OrganizationId = OrganizationId, Role = role });
        var controller = CreateController(service.Object, authority.Object);

        var result = await controller.Get(CancellationToken.None);

        AssertForbidden(result.Result!);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Request_UsesTrustedContextInsteadOfCallerSuppliedOrganizationId()
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var authority = ActiveAuthority("Owner");
        service.Setup(candidate => candidate.RequestAsync((int)OrganizationId, (int)UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RentPaymentAccessDto(Guid.NewGuid(), (int)OrganizationId, "Pending", DateTime.UtcNow, null, null));
        var controller = CreateController(service.Object, authority.Object);
        controller.HttpContext.Request.QueryString = new QueryString("?organizationId=999");

        var result = await controller.Request(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        service.VerifyAll();
    }

    [Fact]
    public async Task Request_Duplicate_ReturnsCurrentStateWithoutAdditionalControllerBehavior()
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var authority = ActiveAuthority("Manager");
        var current = new RentPaymentAccessDto(Guid.NewGuid(), (int)OrganizationId, "Approved", DateTime.UtcNow.AddDays(-1), DateTime.UtcNow, "Approved");
        service.Setup(candidate => candidate.RequestAsync((int)OrganizationId, (int)UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(current);
        var controller = CreateController(service.Object, authority.Object);

        var result = await controller.Request(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(current, ok.Value);
        service.VerifyAll();
    }

    [Fact]
    public async Task Request_SuspendedAccessRequest_ReturnsSafeConflict()
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var authority = ActiveAuthority("Owner");
        service.Setup(candidate => candidate.RequestAsync((int)OrganizationId, (int)UserId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new RentPaymentAccessInvalidTransitionException());
        var controller = CreateController(service.Object, authority.Object);

        var result = await controller.Request(CancellationToken.None);

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        var message = conflict.Value!.GetType().GetProperty("message")!.GetValue(conflict.Value) as string;
        Assert.Equal("The rent-payment access request cannot be made in its current state.", message);
        service.VerifyAll();
    }

    private static Mock<IOrganizationAuthorityResolver> ActiveAuthority(string role)
    {
        var authority = new Mock<IOrganizationAuthorityResolver>(MockBehavior.Strict);
        authority.Setup(candidate => candidate.ResolveActiveMemberAsync(UserId, OrganizationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationMember { UserId = UserId, OrganizationId = OrganizationId, Role = role, IsActive = true });
        return authority;
    }

    private static RentPaymentAccessController CreateController(
        IRentPaymentAccessService service,
        IOrganizationAuthorityResolver authority)
    {
        var controller = new RentPaymentAccessController(service, authority)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Items["OrganizationId"] = OrganizationId;
        controller.HttpContext.Items["UserId"] = UserId;
        return controller;
    }

    private static void AssertForbidden(ActionResult<RentPaymentAccessDto> result)
    {
        var forbidden = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
    }
}
