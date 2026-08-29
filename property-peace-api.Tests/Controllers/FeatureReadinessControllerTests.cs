using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class FeatureReadinessControllerTests
{
    [Fact]
    public async Task Rent_payment_action_route_uses_authenticated_user_and_middleware_organization()
    {
        var aggregate = new Mock<IFeatureReadinessService>(MockBehavior.Strict);
        var actions = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        var expected = new RentPaymentActionReadiness(
            RentPaymentAction.Configure, true, "Approved", true, true, false, false, true, []);
        actions.Setup(x => x.EvaluateAsync(42, 701, RentPaymentAction.Configure, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var controller = CreateController(aggregate.Object, actions.Object, 42, 701);

        var result = await controller.GetRentPaymentConfigureReadiness(CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>()
            .Which.Value.Should().BeSameAs(expected);
    }

    [Fact]
    public async Task Pay_route_evaluates_the_pay_action()
    {
        var aggregate = new Mock<IFeatureReadinessService>(MockBehavior.Strict);
        var actions = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        var expected = new RentPaymentActionReadiness(
            RentPaymentAction.Pay, false, "Approved", true, true, false, false, true, ["connected_payee_missing"]);
        actions.Setup(x => x.EvaluateAsync(42, 701, RentPaymentAction.Pay, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var controller = CreateController(aggregate.Object, actions.Object, 42, 701);

        var result = await controller.GetRentPaymentPayReadiness(CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>()
            .Which.Value.Should().BeSameAs(expected);
    }

    [Fact]
    public async Task Rent_payment_action_route_requires_a_trusted_organization_context()
    {
        var aggregate = new Mock<IFeatureReadinessService>(MockBehavior.Strict);
        var actions = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        var controller = CreateController(aggregate.Object, actions.Object, 42, null);

        var result = await controller.GetRentPaymentPayReadiness(CancellationToken.None);

        result.Result.Should().BeOfType<ForbidResult>();
    }

    private static FeatureReadinessController CreateController(
        IFeatureReadinessService aggregate,
        IRentPaymentActionReadinessService actions,
        int userId,
        long? organizationId)
    {
        var controller = new FeatureReadinessController(aggregate, actions)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test"));
        if (organizationId.HasValue) controller.HttpContext.Items["OrganizationId"] = organizationId.Value;
        return controller;
    }
}