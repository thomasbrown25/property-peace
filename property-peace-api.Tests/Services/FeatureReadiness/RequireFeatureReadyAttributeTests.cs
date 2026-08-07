using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Services.FeatureReadiness;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.FeatureReadiness;

public class RequireFeatureReadyAttributeTests
{
    [Fact]
    public async Task Filter_PassesCanonicalRequestOrganizationToReadinessService()
    {
        var readinessService = new Mock<IFeatureReadinessService>();
        readinessService.Setup(service => service.GetAsync(42, 99, FeatureKeys.TenantScreening))
            .ReturnsAsync(FeatureReadinessEvaluator.Evaluate(
                FeatureKeys.TenantScreening, FeatureReadinessState.Pilot,
                true, false, true, true));
        var services = new ServiceCollection().AddSingleton(readinessService.Object).BuildServiceProvider();
        var httpContext = new DefaultHttpContext { RequestServices = services };
        httpContext.Items["OrganizationId"] = 99L;
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var executingContext = new ActionExecutingContext(
            actionContext, [], new Dictionary<string, object?>(), new object());

        await new RequireFeatureReadyAttribute(FeatureKeys.TenantScreening).OnActionExecutionAsync(
            executingContext,
            () => Task.FromResult(new ActionExecutedContext(actionContext, [], new object())));

        readinessService.Verify(service => service.GetAsync(42, 99, FeatureKeys.TenantScreening), Times.Once);
        executingContext.Result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }

    [Fact]
    public async Task Filter_DoesNotInvokeAction_WhenCanonicalReadinessDeniesFeature()
    {
        var readinessService = new Mock<IFeatureReadinessService>();
        readinessService.Setup(service => service.GetAsync(42, null, FeatureKeys.TenantScreening))
            .ReturnsAsync(FeatureReadinessEvaluator.Evaluate(
                FeatureKeys.TenantScreening, FeatureReadinessState.Unavailable,
                true, true, true, true));

        var services = new ServiceCollection()
            .AddSingleton(readinessService.Object)
            .BuildServiceProvider();
        var httpContext = new DefaultHttpContext { RequestServices = services };
        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
        var actionContext = new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
        var executingContext = new ActionExecutingContext(
            actionContext, [], new Dictionary<string, object?>(), new object());
        var actionInvoked = false;

        await new RequireFeatureReadyAttribute(FeatureKeys.TenantScreening).OnActionExecutionAsync(
            executingContext,
            () =>
            {
                actionInvoked = true;
                return Task.FromResult(new ActionExecutedContext(actionContext, [], new object()));
            });

        actionInvoked.Should().BeFalse();
        executingContext.Result.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
    }
}
