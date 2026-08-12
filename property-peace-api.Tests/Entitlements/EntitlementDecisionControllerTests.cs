using System.Reflection;
using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Entitlements;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class EntitlementDecisionControllerTests
{
    [Theory]
    [InlineData("free")]
    [InlineData("premium")]
    [InlineData("lifetime")]
    public async Task Allowed_decisions_for_each_current_plan_are_returned_as_safe_wire_contracts(string plan)
    {
        var decision = Decision(true, EntitlementDecisionCategory.Allowed, EntitlementReasonCodes.Allowed,
            new PlanKey(plan), quota: new EntitlementQuota("units", 5), diagnostics: ["secret diagnostic"]);
        var service = new RecordingDecisionService(decision);
        var controller = Controller(service, userId: 42, organizationId: 17);

        var result = await controller.Get("property-management", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var wire = Assert.IsType<EntitlementDecisionResponse>(ok.Value);
        Assert.True(wire.IsAllowed);
        Assert.Equal(EntitlementCatalog.Version, wire.MatrixVersion);
        Assert.Equal("property-management", wire.FeatureKey);
        Assert.Equal(plan, wire.EffectivePlan);
        Assert.Equal("allowed", wire.ReasonCode);
        Assert.Equal("allowed", wire.Category);
        Assert.Equal(new EntitlementQuotaResponse("units", 5), wire.Quota);
        Assert.Empty(wire.RequiredAddOns);
        Assert.Empty(wire.ReadinessDependencies);
        Assert.Null(typeof(EntitlementDecisionResponse).GetProperty("Diagnostics"));
        JsonSerializer.Serialize(wire, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            .Should().NotContain("secret diagnostic");
    }

    [Theory]
    [InlineData(EntitlementDecisionCategory.Upgrade, "upgrade-required", "upgrade")]
    [InlineData(EntitlementDecisionCategory.Setup, "setup-required", "setup")]
    [InlineData(EntitlementDecisionCategory.Unauthorized, "unauthorized", "unauthorized")]
    [InlineData(EntitlementDecisionCategory.Unavailable, "unavailable", "unavailable")]
    public async Task Normal_product_denials_return_200_for_SPA_rendering(
        EntitlementDecisionCategory category, string reason, string categoryWire)
    {
        var decision = Decision(false, category, new EntitlementReasonCode(reason), PlanKeys.Premium,
            requiredAddOns: [AddOnKeys.SmsMessaging],
            readiness: [ReadinessDependencyKeys.SmsNumberConfigured]);
        var controller = Controller(new RecordingDecisionService(decision), 42, 17);

        var result = await controller.Get("sms-messaging", CancellationToken.None);

        var wire = Assert.IsType<EntitlementDecisionResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.False(wire.IsAllowed);
        Assert.Equal(reason, wire.ReasonCode);
        Assert.Equal(categoryWire, wire.Category);
        Assert.Equal(["sms-messaging"], wire.RequiredAddOns);
        Assert.Equal(["sms-number-configured"], wire.ReadinessDependencies);
    }

    [Theory]
    [InlineData("not-catalogued")]
    [InlineData("Advanced-Reporting")]
    [InlineData("")]
    [InlineData(" advanced-reporting ")]
    public async Task Unknown_or_malformed_feature_is_generic_404_and_never_calls_service(string feature)
    {
        var service = new RecordingDecisionService(Decision(true, EntitlementDecisionCategory.Allowed,
            EntitlementReasonCodes.Allowed, PlanKeys.Premium));
        var controller = Controller(service, 42, 17);

        var result = await controller.Get(feature, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Null(service.Request);
    }

    [Fact]
    public async Task Missing_middleware_subject_returns_401_without_calling_service()
    {
        var service = Service();
        var result = await Controller(service, userId: null, organizationId: 17)
            .Get("advanced-reporting", CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Null(service.Request);
    }

    [Fact]
    public async Task Missing_selected_organization_returns_403_without_calling_service()
    {
        var service = Service();
        var result = await Controller(service, userId: 42, organizationId: null)
            .Get("advanced-reporting", CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
        Assert.Null(service.Request);
    }

    [Fact]
    public async Task Constructs_exact_request_only_from_middleware_scope_and_preserves_cancellation()
    {
        using var cancellation = new CancellationTokenSource();
        var service = Service();
        var controller = Controller(service, 987, 654);
        controller.Request.Headers["X-User-Id"] = "1";
        controller.Request.Headers["X-Organization-Id"] = "2";
        controller.Request.QueryString = new QueryString("?userId=3&organizationId=4");

        await controller.Get("advanced-reporting", cancellation.Token);

        Assert.Equal(new EntitlementDecisionRequest("987", 654, FeatureKeys.AdvancedReporting), service.Request);
        Assert.Equal(cancellation.Token, service.CancellationToken);
    }

    [Theory]
    [InlineData("policy-error")]
    [InlineData("facts-unavailable")]
    public async Task Internal_decision_failure_returns_existing_generic_503_without_diagnostics(string reason)
    {
        var decision = Decision(false, EntitlementDecisionCategory.Unavailable,
            new EntitlementReasonCode(reason), null, diagnostics: ["database host secret"]);
        var controller = Controller(new RecordingDecisionService(decision), 42, 17);

        var result = await controller.Get("advanced-reporting", CancellationToken.None);

        var unavailable = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, unavailable.StatusCode);
        var wire = Assert.IsType<EntitlementDeniedResponse>(unavailable.Value);
        Assert.Equal("This feature is currently unavailable. Try again later.", wire.Message);
        Assert.Equal(reason, wire.ReasonCode);
        JsonSerializer.Serialize(wire, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            .Should().NotContain("database host secret");
    }

    [Fact]
    public async Task Cancellation_from_decision_service_is_not_converted_to_503()
    {
        var controller = Controller(new CancelingDecisionService(), 42, 17);
        using var source = new CancellationTokenSource();
        source.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => controller.Get("advanced-reporting", source.Token));
    }

    [Fact]
    public async Task Route_and_inventory_contract_is_authenticated_lowercase_GET_and_accepts_every_catalog_feature()
    {
        var type = typeof(EntitlementDecisionController);
        Assert.Equal("api/entitlements", type.GetCustomAttribute<RouteAttribute>()?.Template);
        Assert.NotNull(type.GetCustomAttribute<AuthorizeAttribute>());
        var action = type.GetMethod(nameof(EntitlementDecisionController.Get));
        Assert.Equal("{featureKey}", action?.GetCustomAttribute<HttpGetAttribute>()?.Template);
        Assert.DoesNotContain(action!.GetParameters(), parameter =>
            parameter.GetCustomAttribute<FromQueryAttribute>() is not null ||
            parameter.GetCustomAttribute<FromHeaderAttribute>() is not null);
        Assert.Equal(
            [
                "IsAllowed", "MatrixVersion", "FeatureKey", "EffectivePlan", "ReasonCode", "Category",
                "Quota", "RequiredAddOns", "ReadinessDependencies"
            ],
            typeof(EntitlementDecisionResponse).GetProperties().Select(property => property.Name));

        foreach (var feature in EntitlementCatalog.Features)
        {
            var service = new RecordingDecisionService(Decision(true, EntitlementDecisionCategory.Allowed,
                EntitlementReasonCodes.Allowed, PlanKeys.Premium, feature: feature.Key));
            var result = await Controller(service, 42, 17).Get(feature.Key.Value, CancellationToken.None);
            Assert.IsType<OkObjectResult>(result);
            Assert.Equal(feature.Key, service.Request?.Feature);
        }
    }

    private static RecordingDecisionService Service() => new(Decision(true,
        EntitlementDecisionCategory.Allowed, EntitlementReasonCodes.Allowed, PlanKeys.Premium));

    private static EntitlementDecisionController Controller(
        IEntitlementDecisionService service, long? userId, long? organizationId)
    {
        var context = new DefaultHttpContext();
        if (userId.HasValue) context.Items["UserId"] = userId.Value;
        if (organizationId.HasValue) context.Items["OrganizationId"] = organizationId.Value;
        return new EntitlementDecisionController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }

    private static UnifiedEntitlementDecision Decision(
        bool allowed,
        EntitlementDecisionCategory category,
        EntitlementReasonCode reason,
        PlanKey? plan,
        EntitlementQuota? quota = null,
        IEnumerable<AddOnKey>? requiredAddOns = null,
        IEnumerable<ReadinessDependencyKey>? readiness = null,
        IEnumerable<string>? diagnostics = null,
        FeatureKey? feature = null) =>
        new(allowed, category, EntitlementCatalog.Version, feature ?? FeatureKeys.PropertyManagement,
            plan, reason, quota, requiredAddOns, readiness, diagnostics);

    private sealed class RecordingDecisionService(UnifiedEntitlementDecision decision) : IEntitlementDecisionService
    {
        public EntitlementDecisionRequest? Request { get; private set; }
        public CancellationToken CancellationToken { get; private set; }

        public Task<UnifiedEntitlementDecision> DecideAsync(
            EntitlementDecisionRequest request, CancellationToken cancellationToken = default)
        {
            Request = request;
            CancellationToken = cancellationToken;
            return Task.FromResult(decision);
        }
    }

    private sealed class CancelingDecisionService : IEntitlementDecisionService
    {
        public Task<UnifiedEntitlementDecision> DecideAsync(
            EntitlementDecisionRequest request, CancellationToken cancellationToken = default) =>
            Task.FromCanceled<UnifiedEntitlementDecision>(cancellationToken);
    }
}
