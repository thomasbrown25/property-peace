using System.Reflection;
using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class PaymentControllerSafetyTests
{
    [Theory]
    [InlineData(typeof(PaymentController), nameof(PaymentController.AddPayment))]
    [InlineData(typeof(PaymentController), nameof(PaymentController.GetPaymentsByLeaseId))]
    [InlineData(typeof(RentCollectionController), nameof(RentCollectionController.AddPayment))]
    public void ManualPaymentEndpoints_AreLandlordOrAdminOnly(Type controllerType, string actionName)
    {
        var method = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(candidate => candidate.Name == actionName);

        var roles = method.GetCustomAttribute<AuthorizeAttribute>()?.Roles?
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

        roles.Should().BeEquivalentTo("Landlord", "Admin");
        roles.Should().NotContain("Tenant");
    }

    [Fact]
    public async Task AddPayment_OverwritesBrowserProviderProvenanceForManualEntry()
    {
        var paymentService = new Mock<IPaymentService>(MockBehavior.Strict);
        AddPaymentDto? captured = null;
        paymentService.Setup(service => service.AddManualPayment(It.IsAny<AddPaymentDto>(), 10))
            .Callback((AddPaymentDto dto, long _) => captured = dto)
            .ReturnsAsync(new ServiceResponse<List<LoadPaymentDto>>
            {
                Success = true,
                Data = []
            });
        var controller = new PaymentController(paymentService.Object, Mock.Of<IUserService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, "42"),
                        new Claim(ClaimTypes.Role, "Landlord")
                    ], "test"))
                }
            }
        };
        controller.HttpContext.Items["OrganizationId"] = 10L;
        var input = new AddPaymentDto
        {
            LeaseId = 7,
            Amount = 900m,
            Method = "Stripe ACH",
            Status = "Processing",
            StripePaymentIntentId = "pi_browser_forged",
            StripePaymentMethodId = "pm_browser_forged"
        };

        var result = await controller.AddPayment(input);

        result.Should().BeOfType<OkObjectResult>();
        captured.Should().NotBeNull();
        captured!.CreatedByUserId.Should().Be(42);
        captured.Method.Should().Be("Manual Entry");
        captured.Status.Should().Be("Completed");
        captured.StripePaymentIntentId.Should().BeNull();
        captured.StripePaymentMethodId.Should().BeNull();
    }
}
