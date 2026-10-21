using System.Security.Claims;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectSetupReadyFilterTests
{
    [Theory]
    [InlineData(null, 503)]
    [InlineData("placeholder", 503)]
    [InlineData("sk_test_placeholder", 503)]
    [InlineData("sk_test_local", 0)]
    public async Task SetupReadiness_UsesStripeSecretNotRentSwitchOrApproval(string? secret, int expectedStatus)
    {
        var payees = new Mock<IStripeConnectedPayeeService>();
        payees.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OwnedStripeAccount(42, null));
        var (context, called) = CreateContext(secret, payees.Object);
        var executed = false;
        ActionExecutionDelegate next = () =>
        {
            executed = true;
            return called();
        };
        await new RequireStripeConnectSetupReadyAttribute().OnActionExecutionAsync(context, next);
        (context.Result as ObjectResult)?.StatusCode.Should().Be(expectedStatus == 0 ? null : expectedStatus);
        executed.Should().Be(expectedStatus == 0);
        if (expectedStatus == 0) payees.Verify(x => x.ResolveOwnedAccountForOnboardingAsync(42, 77, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetupReadiness_RejectsForgedIdentityBeforeCallingResolver()
    {
        var payees = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var (context, called) = CreateContext("sk_test_local", payees.Object);
        context.HttpContext.Items["UserId"] = 51L;
        await new RequireStripeConnectSetupReadyAttribute().OnActionExecutionAsync(context, called);
        ((ObjectResult)context.Result!).StatusCode.Should().Be(403);
        payees.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SetupReadiness_RejectsMissingOwnership()
    {
        var (context, called) = CreateContext("sk_test_local", Mock.Of<IStripeConnectedPayeeService>());
        await new RequireStripeConnectSetupReadyAttribute().OnActionExecutionAsync(context, called);
        ((ObjectResult)context.Result!).StatusCode.Should().Be(403);
    }

    private static (ActionExecutingContext, ActionExecutionDelegate) CreateContext(string? secret, IStripeConnectedPayeeService payees)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Stripe:SecretKey"] = secret,
            ["Stripe:RentPaymentsEnabled"] = "false"
        }).Build();
        var services = new ServiceCollection().AddSingleton<IConfiguration>(configuration)
            .AddSingleton(payees).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services,
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "42")], "test")) };
        http.Items["UserId"] = 42L;
        http.Items["OrganizationId"] = 77L;
        var actionContext = new ActionContext(http, new RouteData(), new ActionDescriptor());
        var executing = new ActionExecutingContext(actionContext, [], new Dictionary<string, object?>(), new object());
        ActionExecutionDelegate next = () => Task.FromResult(new ActionExecutedContext(actionContext, [], new object()));
        return (executing, next);
    }
}
