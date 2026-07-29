using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.BankAccountService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeControllerSecurityTests
{
    [Fact]
    public async Task CreatePaymentIntent_WhenEmergencyGateDefaultsClosed_ReturnsServiceUnavailable()
    {
        var stripeService = new Mock<IStripeService>();
        stripeService
            .Setup(service => service.CreatePaymentIntentAsync(123, 500m, "Rent"))
            .ReturnsAsync(new ServiceResponse<CreatePaymentIntentResponseDto>
            {
                Data = new CreatePaymentIntentResponseDto
                {
                    ClientSecret = "secret",
                    PaymentIntentId = "pi_123"
                }
            });
        var controller = CreateController(stripeService.Object);

        var result = await controller.CreatePaymentIntent(new CreatePaymentIntentDto
        {
            LeaseId = 123,
            Amount = 500m,
            Description = "Rent"
        });

        result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(503);
        stripeService.Verify(
            service => service.CreatePaymentIntentAsync(
                It.IsAny<long>(),
                It.IsAny<decimal>(),
                It.IsAny<string?>()),
            Times.Never);
    }

    [Theory]
    [InlineData(nameof(StripeController.CreatePaymentIntent))]
    [InlineData(nameof(StripeController.UpdatePaymentIntent))]
    [InlineData(nameof(StripeController.ConfirmPayment))]
    [InlineData(nameof(StripeController.ConfirmPaymentAllocated))]
    public void RentPaymentMutation_RequiresTenantRole(string actionName)
    {
        var action = typeof(StripeController).GetMethod(actionName, BindingFlags.Instance | BindingFlags.Public);

        action.Should().NotBeNull();
        var authorize = action!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault();
        authorize.Should().NotBeNull();
        authorize!.Roles.Should().Be("Tenant");
    }

    [Fact]
    public void ArbitraryExistingAccountLinking_HasNoRoutablePostAction()
    {
        var linkAction = typeof(StripeController)
            .GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .SingleOrDefault(method => method
                .GetCustomAttributes<HttpPostAttribute>()
                .Any(attribute => attribute.Template == "link-account"));

        linkAction.Should().BeNull();
    }

    private static StripeController CreateController(IStripeService stripeService)
    {
        return new StripeController(
            stripeService,
            Mock.Of<IUserService>(),
            Mock.Of<IOrganizationService>(),
            Mock.Of<IBankAccountService>(),
            Mock.Of<IBankAccountRepository>(),
            Mock.Of<IUserRepository>(),
            Mock.Of<ILogger<StripeController>>());
    }
}
