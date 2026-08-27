using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.RentPaymentAccess;
using brownstone_hub_api.Services.RentPaymentAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class AdminRentPaymentAccessControllerTests
{
    private const int AdminUserId = 99;

    [Fact]
    public void Routes_RequirePlatformAdminAuthorization_AndLandingDetailIsReadOnly()
    {
        var type = typeof(AdminRentPaymentAccessController);
        var authorization = type.GetCustomAttributes<AuthorizeAttribute>(true).Single();

        Assert.Equal("Admin", authorization.Roles);
        Assert.NotNull(type.GetMethod(nameof(AdminRentPaymentAccessController.Get))?.GetCustomAttribute<HttpGetAttribute>());
        Assert.NotNull(type.GetMethod(nameof(AdminRentPaymentAccessController.Approve))?.GetCustomAttribute<HttpPostAttribute>());
        Assert.NotNull(type.GetMethod(nameof(AdminRentPaymentAccessController.Reject))?.GetCustomAttribute<HttpPostAttribute>());
        Assert.NotNull(type.GetMethod(nameof(AdminRentPaymentAccessController.Suspend))?.GetCustomAttribute<HttpPostAttribute>());
    }

    [Fact]
    public async Task Get_MissingPublicId_ReturnsNotFound()
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var publicId = Guid.NewGuid();
        service.Setup(candidate => candidate.GetForAdminAsync(publicId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((RentPaymentAccessAdminDetailDto?)null);
        var controller = CreateController(service.Object);

        var result = await controller.Get(publicId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result.Result);
        service.VerifyAll();
    }

    [Theory]
    [InlineData("approve")]
    [InlineData("reject")]
    [InlineData("suspend")]
    public async Task Review_StaleVersion_ReturnsConflict(string action)
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var publicId = Guid.NewGuid();
        var review = new ReviewRentPaymentAccessRequestDto("Reason", null, [1]);
        SetupReviewException(service, action, publicId, review, new RentPaymentAccessConcurrencyException());
        var controller = CreateController(service.Object);

        var result = await InvokeReview(controller, action, publicId, review);

        Assert.IsType<ConflictObjectResult>(result.Result);
        service.VerifyAll();
    }

    [Theory]
    [InlineData("approve")]
    [InlineData("reject")]
    [InlineData("suspend")]
    public async Task Review_InvalidTransition_ReturnsConflict(string action)
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var publicId = Guid.NewGuid();
        var review = new ReviewRentPaymentAccessRequestDto("Reason", null, [1]);
        SetupReviewException(service, action, publicId, review, new RentPaymentAccessInvalidTransitionException());
        var controller = CreateController(service.Object);

        var result = await InvokeReview(controller, action, publicId, review);

        Assert.IsType<ConflictObjectResult>(result.Result);
        service.VerifyAll();
    }

    [Theory]
    [InlineData("reject")]
    [InlineData("suspend")]
    public async Task RejectOrSuspend_WithoutSafeReason_ReturnsBadRequestWithoutCallingService(string action)
    {
        var service = new Mock<IRentPaymentAccessService>(MockBehavior.Strict);
        var controller = CreateController(service.Object);
        var review = new ReviewRentPaymentAccessRequestDto("  ", null, [1]);

        var result = await InvokeReview(controller, action, Guid.NewGuid(), review);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public void OrganizationResponseDto_NeverExposesInternalNotes()
    {
        Assert.Null(typeof(RentPaymentAccessDto).GetProperty("InternalNotes"));
    }

    private static AdminRentPaymentAccessController CreateController(IRentPaymentAccessService service) =>
        new(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(ClaimTypes.NameIdentifier, AdminUserId.ToString()), new Claim(ClaimTypes.Role, "Admin")], "test"))
                }
            }
        };

    private static void SetupReviewException(
        Mock<IRentPaymentAccessService> service,
        string action,
        Guid publicId,
        ReviewRentPaymentAccessRequestDto review,
        Exception exception)
    {
        switch (action)
        {
            case "approve":
                service.Setup(candidate => candidate.ApproveAsync(publicId, AdminUserId, review, It.IsAny<CancellationToken>())).ThrowsAsync(exception);
                break;
            case "reject":
                service.Setup(candidate => candidate.RejectAsync(publicId, AdminUserId, review, It.IsAny<CancellationToken>())).ThrowsAsync(exception);
                break;
            default:
                service.Setup(candidate => candidate.SuspendAsync(publicId, AdminUserId, review, It.IsAny<CancellationToken>())).ThrowsAsync(exception);
                break;
        }
    }

    private static Task<ActionResult<RentPaymentAccessAdminDetailDto>> InvokeReview(
        AdminRentPaymentAccessController controller,
        string action,
        Guid publicId,
        ReviewRentPaymentAccessRequestDto review) => action switch
        {
            "approve" => controller.Approve(publicId, review, CancellationToken.None),
            "reject" => controller.Reject(publicId, review, CancellationToken.None),
            _ => controller.Suspend(publicId, review, CancellationToken.None)
        };
}
