using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.BankReconciliationService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class BankReconciliationControllerOrganizationContextTests
{
    [Fact]
    public async Task MatchTransaction_UsesMiddlewareOrganizationContext_NotPersistedCurrentOrganization()
    {
        const long selectedOrganizationId = 202;
        const long persistedOrganizationId = 101;
        var service = new Mock<IBankReconciliationService>();
        service.Setup(candidate => candidate.MatchTransactionAsync(selectedOrganizationId, 10, 20))
            .ReturnsAsync(ServiceResponse<bool>.CreateSuccess(true));
        var users = new Mock<IUserService>();
        users.Setup(candidate => candidate.GetCurrentUserIdAsync())
            .ReturnsAsync(ServiceResponse<long?>.CreateSuccess(42));
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(candidate => candidate.GetCurrentUserOrganizationAsync(42))
            .ReturnsAsync(ServiceResponse<LoadOrganizationDto>.CreateSuccess(new LoadOrganizationDto
            {
                Id = persistedOrganizationId
            }));
        var controller = new BankReconciliationController(
            service.Object,
            organizations.Object,
            users.Object,
            NullLogger<BankReconciliationController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Items["OrganizationId"] = selectedOrganizationId;

        var result = await controller.MatchTransaction(new MatchTransactionDto
        {
            BankTransactionId = 10,
            LedgerEntryId = 20
        });

        Assert.IsType<OkObjectResult>(result);
        service.Verify(candidate => candidate.MatchTransactionAsync(selectedOrganizationId, 10, 20), Times.Once);
        organizations.Verify(candidate => candidate.GetCurrentUserOrganizationAsync(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task MatchTransaction_WithoutMiddlewareOrganizationContext_ReturnsForbiddenWithoutCallingService()
    {
        var service = new Mock<IBankReconciliationService>();
        var controller = new BankReconciliationController(
            service.Object,
            new Mock<IOrganizationService>().Object,
            new Mock<IUserService>().Object,
            NullLogger<BankReconciliationController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.MatchTransaction(new MatchTransactionDto());

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        service.Verify(candidate => candidate.MatchTransactionAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }
}
