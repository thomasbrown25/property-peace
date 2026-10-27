using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class ShortStayPaymentControllerBoundaryTests
{
    [Fact]
    public void Payment_start_requires_bearer_authorization_and_has_no_caller_money_fields()
    {
        var type = typeof(ShortStayPaymentController);
        Assert.NotNull(type.GetCustomAttribute<AuthorizeAttribute>());
        Assert.Null(type.GetCustomAttribute<AllowAnonymousAttribute>());
        var route = type.GetCustomAttribute<RouteAttribute>();
        Assert.Equal("api/short-stay/holds", route?.Template);
        var method = type.GetMethod(nameof(ShortStayPaymentController.StartPayment))!;
        Assert.Equal("{code}/start-payment", method.GetCustomAttribute<HttpPostAttribute>()?.Template);
        Assert.Null(method.GetCustomAttribute<HttpGetAttribute>());
        Assert.All(method.GetParameters(), p => Assert.Contains(p.ParameterType, new[] { typeof(string), typeof(CancellationToken) }));
        Assert.DoesNotContain(method.GetParameters(), p => p.GetCustomAttribute<FromBodyAttribute>() is not null);
        Assert.Contains(type.GetConstructors().Single().GetParameters(), p => p.ParameterType == typeof(ShortStayStartPaymentService));
        Assert.Contains(type.GetConstructors().Single().GetParameters(), p => p.ParameterType == typeof(IConfiguration));
    }
}
