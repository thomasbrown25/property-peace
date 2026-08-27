using brownstone_hub_api.Filters;
using brownstone_hub_api.Services.RentPaymentAccess;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Filters;

public sealed class RequireRentPaymentActionReadyAttributeTests
{
    [Fact]
    public async Task Allowed_action_uses_middleware_selected_actor_and_organization()
    {
        var readiness = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        readiness.Setup(service => service.EvaluateAsync(42, 71, RentPaymentAction.Configure, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Allowed(RentPaymentAction.Configure));
        var fixture = CreateFixture(readiness.Object);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeTrue();
        fixture.Context.Result.Should().BeNull();
        readiness.Verify(service => service.EvaluateAsync(
            42, 71, RentPaymentAction.Configure, fixture.Context.HttpContext.RequestAborted), Times.Once);
    }

    [Fact]
    public async Task Denied_action_returns_forbidden_with_stable_blocker_codes()
    {
        var readiness = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        readiness.Setup(service => service.EvaluateAsync(42, 71, RentPaymentAction.Configure, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Denied(RentPaymentAction.Configure, "provider_disabled", "access_not_approved"));
        var fixture = CreateFixture(readiness.Object);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        var result = fixture.Context.Result.Should().BeOfType<ObjectResult>().Subject;
        result.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        GetBlockers(result).Should().Equal("provider_disabled", "access_not_approved");
    }

    [Fact]
    public async Task Returned_unavailable_readiness_returns_service_unavailable_with_its_stable_blocker_codes()
    {
        var readiness = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        readiness.Setup(service => service.EvaluateAsync(42, 71, RentPaymentAction.Configure, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Unavailable(RentPaymentAction.Configure, "provider_disabled", "access_not_approved"));
        var fixture = CreateFixture(readiness.Object);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        var result = fixture.Context.Result.Should().BeOfType<ObjectResult>().Subject;
        result.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        GetBlockers(result).Should().Equal("provider_disabled", "access_not_approved");
    }

    [Fact]
    public void Request_access_cannot_use_the_action_readiness_filter()
    {
        var act = () => new RequireRentPaymentActionReadyAttribute(RentPaymentAction.RequestAccess);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task Missing_middleware_scope_fails_closed_without_calling_readiness_service()
    {
        var readiness = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        var fixture = CreateFixture(readiness.Object, includeScope: false);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        var result = fixture.Context.Result.Should().BeOfType<ObjectResult>().Subject;
        result.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        GetBlockers(result).Should().Contain("actor_not_authorized");
        readiness.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Readiness_service_failure_returns_unavailable_with_stable_blocker_codes()
    {
        var readiness = new Mock<IRentPaymentActionReadinessService>(MockBehavior.Strict);
        readiness.Setup(service => service.EvaluateAsync(42, 71, RentPaymentAction.Configure, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("unavailable"));
        var fixture = CreateFixture(readiness.Object);

        await fixture.InvokeAsync();

        fixture.NextCalled.Should().BeFalse();
        var result = fixture.Context.Result.Should().BeOfType<ObjectResult>().Subject;
        result.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        GetBlockers(result).Should().Equal("provider_disabled", "access_not_approved", "actor_not_authorized");
    }

    private static Fixture CreateFixture(IRentPaymentActionReadinessService readiness, bool includeScope = true)
    {
        var services = new ServiceCollection().AddSingleton(readiness).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        if (includeScope)
        {
            http.Items["UserId"] = 42L;
            http.Items["OrganizationId"] = 71L;
        }

        var actionContext = new ActionContext(http, new RouteData(), new ActionDescriptor());
        return new Fixture(
            new ActionExecutingContext(actionContext, [], new Dictionary<string, object?>(), new object()),
            new RequireRentPaymentActionReadyAttribute(RentPaymentAction.Configure));
    }

    private static IReadOnlyList<string> GetBlockers(ObjectResult result) =>
        (IReadOnlyList<string>)result.Value!.GetType().GetProperty("Blockers")!.GetValue(result.Value)!;

    private static RentPaymentActionReadiness Allowed(RentPaymentAction action) => new(
        action, true, "Approved", true, true, false, false, false, []);

    private static RentPaymentActionReadiness Denied(RentPaymentAction action, params string[] blockers) => new(
        action, false, "NotRequested", false, false, false, false, false, blockers);

    private static RentPaymentActionReadiness Unavailable(RentPaymentAction action, params string[] blockers) => new(
        action, false, "Unavailable", false, false, false, false, false, blockers);

    private sealed class Fixture(ActionExecutingContext context, RequireRentPaymentActionReadyAttribute attribute)
    {
        public ActionExecutingContext Context { get; } = context;
        public RequireRentPaymentActionReadyAttribute Attribute { get; } = attribute;
        public bool NextCalled { get; private set; }

        public Task InvokeAsync() => Attribute.OnActionExecutionAsync(Context, () =>
        {
            NextCalled = true;
            return Task.FromResult(new ActionExecutedContext(Context, [], new object()));
        });
    }
}
