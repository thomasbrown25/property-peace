using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.SubscriptionService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class ReportEntitlementFilterTests
{
    [Theory]
    [InlineData(null, 10L, 401, "invalid-input")]
    [InlineData(42L, null, 403, "organization-required")]
    public async Task Missing_middleware_owned_scope_denies_without_service_invocation(
        long? userId, long? organizationId, int statusCode, string reasonCode)
    {
        var service = new StubDecisionService(Allowed());
        var context = Context(service, userId, organizationId);

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, Next);

        Assert.Equal(0, service.CallCount);
        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(statusCode, result.StatusCode);
        var contract = Assert.IsType<EntitlementDeniedResponse>(result.Value);
        Assert.False(contract.Success);
        Assert.Equal(EntitlementCatalog.Version, contract.MatrixVersion);
        Assert.Equal("advanced-reporting", contract.FeatureKey);
        Assert.Equal(reasonCode, contract.ReasonCode);
        Assert.False(string.IsNullOrWhiteSpace(contract.Message));
    }

    [Fact]
    public async Task Denial_returns_stable_non_secret_wire_contract_and_uses_trusted_feature()
    {
        var denied = new UnifiedEntitlementDecision(false, EntitlementDecisionCategory.Upgrade,
            EntitlementCatalog.Version, FeatureKeys.AdvancedReporting, PlanKeys.Free,
            EntitlementReasonCodes.UpgradeRequired, diagnostics: ["secret diagnostic"]);
        var service = new StubDecisionService(denied);
        var context = Context(service, 42, 10);

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, Next);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(403, result.StatusCode);
        var contract = Assert.IsType<EntitlementDeniedResponse>(result.Value);
        Assert.Equal("upgrade-required", contract.ReasonCode);
        Assert.Equal("upgrade", contract.Category);
        Assert.Equal("advanced-reporting", contract.FeatureKey);
        Assert.DoesNotContain("secret", contract.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("42", service.Request!.AuthenticatedUserId);
        Assert.Equal(10, service.Request.OrganizationId);
        Assert.Equal(FeatureKeys.AdvancedReporting, service.Request.Feature);
    }

    [Theory]
    [InlineData("policy-error")]
    [InlineData("facts-unavailable")]
    public async Task Infrastructure_failure_returns_generic_503_without_diagnostics(string reason)
    {
        var denied = new UnifiedEntitlementDecision(false, EntitlementDecisionCategory.Unavailable,
            EntitlementCatalog.Version, FeatureKeys.AdvancedReporting, null,
            new EntitlementReasonCode(reason), diagnostics: ["database host secret"]);
        var context = Context(new StubDecisionService(denied), 42, 10);

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, Next);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, result.StatusCode);
        var contract = Assert.IsType<EntitlementDeniedResponse>(result.Value);
        Assert.Equal("This feature is currently unavailable. Try again later.", contract.Message);
        Assert.DoesNotContain("database", contract.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Ordinary_unavailable_denial_returns_403()
    {
        var denied = new UnifiedEntitlementDecision(false, EntitlementDecisionCategory.Unavailable,
            EntitlementCatalog.Version, FeatureKeys.AdvancedReporting, null,
            EntitlementReasonCodes.Unavailable);
        var context = Context(new StubDecisionService(denied), 42, 10);

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, Next);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        var contract = Assert.IsType<EntitlementDeniedResponse>(result.Value);
        Assert.Equal("unavailable", contract.ReasonCode);
        Assert.Equal("This feature is currently unavailable. Try again later.", contract.Message);
    }

    [Fact]
    public async Task Provider_failure_returns_exact_generic_503_response()
    {
        var service = new EntitlementDecisionService(new ThrowingFactsProvider(), TimeProvider.System);
        var context = Context(service, 42, 10);

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, Next);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, result.StatusCode);
        var contract = Assert.IsType<EntitlementDeniedResponse>(result.Value);
        Assert.Equal(new EntitlementDeniedResponse(
            false,
            EntitlementCatalog.Version,
            "advanced-reporting",
            "policy-error",
            "unavailable",
            "This feature is currently unavailable. Try again later."), contract);
    }

    [Fact]
    public async Task Allowed_decision_continues_action_pipeline()
    {
        var service = new StubDecisionService(Allowed());
        var context = Context(service, 42, 10);
        var continued = false;

        await new AdvancedReportingEntitlementAttribute().OnActionExecutionAsync(context, () =>
        {
            continued = true;
            return Next();
        });

        Assert.True(continued);
        Assert.Null(context.Result);
    }

    [Theory]
    [InlineData(typeof(ExpenseReportController))]
    [InlineData(typeof(KPIReportController))]
    [InlineData(typeof(TaxReportController))]
    public void Every_public_report_action_is_centrally_protected_without_legacy_feature_gate(Type controllerType)
    {
        var attribute = Assert.Single(controllerType.GetCustomAttributes<AdvancedReportingEntitlementAttribute>(inherit: true));
        Assert.NotNull(attribute);

        var actions = controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(method => method.GetCustomAttributes().Any(item => item is HttpMethodAttribute))
            .ToArray();
        Assert.NotEmpty(actions);
        Assert.All(actions, action => Assert.True(
            controllerType.IsDefined(typeof(AdvancedReportingEntitlementAttribute), inherit: true) ||
            action.IsDefined(typeof(AdvancedReportingEntitlementAttribute), inherit: true)));

        Assert.DoesNotContain(controllerType.GetConstructors().SelectMany(item => item.GetParameters()),
            parameter => parameter.ParameterType == typeof(IFeatureGateService));
        Assert.DoesNotContain(controllerType.GetFields(BindingFlags.Instance | BindingFlags.NonPublic),
            field => field.FieldType == typeof(IFeatureGateService));
    }

    [Fact]
    public void Entitlement_reason_code_wire_values_are_stable()
    {
        Assert.Equal("allowed", EntitlementReasonCodes.Allowed.Value);
        Assert.Equal("upgrade-required", EntitlementReasonCodes.UpgradeRequired.Value);
        Assert.Equal("setup-required", EntitlementReasonCodes.SetupRequired.Value);
        Assert.Equal("unavailable", EntitlementReasonCodes.Unavailable.Value);
        Assert.Equal("unauthorized", EntitlementReasonCodes.Unauthorized.Value);
        Assert.Equal("paused", EntitlementReasonCodes.Paused.Value);
        Assert.Equal("expired", EntitlementReasonCodes.Expired.Value);
        Assert.Equal("inactive", EntitlementReasonCodes.Inactive.Value);
        Assert.Equal("quota", EntitlementReasonCodes.Quota.Value);
        Assert.Equal("unknown-policy", EntitlementReasonCodes.UnknownPolicy.Value);
        Assert.Equal("invalid-input", EntitlementReasonCodes.InvalidInput.Value);
        Assert.Equal("organization-required", EntitlementReasonCodes.OrganizationRequired.Value);
        Assert.Equal("organization-mismatch", EntitlementReasonCodes.OrganizationMismatch.Value);
        Assert.Equal("subject-mismatch", EntitlementReasonCodes.SubjectMismatch.Value);
        Assert.Equal("membership-required", EntitlementReasonCodes.MembershipRequired.Value);
        Assert.Equal("membership-invited", EntitlementReasonCodes.MembershipInvited.Value);
        Assert.Equal("membership-inactive", EntitlementReasonCodes.MembershipInactive.Value);
        Assert.Equal("membership-removed", EntitlementReasonCodes.MembershipRemoved.Value);
        Assert.Equal("subscription-missing", EntitlementReasonCodes.SubscriptionMissing.Value);
        Assert.Equal("facts-unavailable", EntitlementReasonCodes.FactsUnavailable.Value);
        Assert.Equal("policy-error", EntitlementReasonCodes.PolicyError.Value);
    }

    private static ActionExecutingContext Context(
        IEntitlementDecisionService service, long? userId, long? organizationId)
    {
        var services = new ServiceCollection().AddSingleton(service).BuildServiceProvider();
        var http = new DefaultHttpContext { RequestServices = services };
        if (userId.HasValue) http.Items["UserId"] = userId.Value;
        if (organizationId.HasValue) http.Items["OrganizationId"] = organizationId.Value;
        return new ActionExecutingContext(
            new ActionContext(http, new RouteData(), new ActionDescriptor()),
            [], new Dictionary<string, object?>(), new object());
    }

    private static Task<ActionExecutedContext> Next() => Task.FromResult(
        new ActionExecutedContext(new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()), [], new object()));

    private static UnifiedEntitlementDecision Allowed() => new(true, EntitlementDecisionCategory.Allowed,
        EntitlementCatalog.Version, FeatureKeys.AdvancedReporting, PlanKeys.Premium, EntitlementReasonCodes.Allowed);

    private sealed class ThrowingFactsProvider : IEntitlementDecisionFactsProvider
    {
        public Task<EntitlementDecisionFacts?> GetFactsAsync(
            string authenticatedUserId,
            long organizationId,
            FeatureKey feature,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("database host secret");
    }

    private sealed class StubDecisionService(UnifiedEntitlementDecision decision) : IEntitlementDecisionService
    {
        public int CallCount { get; private set; }
        public EntitlementDecisionRequest? Request { get; private set; }

        public Task<UnifiedEntitlementDecision> DecideAsync(
            EntitlementDecisionRequest request, CancellationToken cancellationToken = default)
        {
            CallCount++;
            Request = request;
            return Task.FromResult(decision);
        }
    }
}
