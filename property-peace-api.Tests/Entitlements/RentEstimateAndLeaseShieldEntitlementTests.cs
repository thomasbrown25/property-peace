using System.Reflection;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.LeaseShieldService;
using brownstone_hub_api.Services.RentEstimateService;
using brownstone_hub_api.Services.SubscriptionService;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class RentEstimateAndLeaseShieldEntitlementTests
{
    [Theory]
    [InlineData("Free", false, "upgrade-required")]
    [InlineData("Premium", true, "allowed")]
    [InlineData("Lifetime Plan", true, "allowed")]
    public void Catalog_packages_both_features_as_premium_or_lifetime_only(
        string persistedPlan, bool allowed, string reason)
    {
        Assert.True(PlanKeyMapping.TryFromPersistedName(persistedPlan, out var plan));

        foreach (var feature in new[] { FeatureKeys.RentEstimate, FeatureKeys.LeaseShieldRead, FeatureKeys.LeaseShieldManage })
        {
            var decision = EntitlementCatalog.Evaluate(
                feature,
                plan,
                new EntitlementEvaluationFacts(
                    ActiveAddOns: new HashSet<AddOnKey>(),
                    Readiness: new Dictionary<ReadinessDependencyKey, bool>()));

            Assert.Equal(allowed, decision.IsAllowed);
            Assert.Equal(reason, decision.Reason.Value);
            Assert.Empty(decision.ReadinessDependencies);
        }
    }

    [Fact]
    public void Controllers_have_no_legacy_feature_gate_or_user_lookup_dependency()
    {
        foreach (var controller in new[] { typeof(RentEstimateController), typeof(LeaseShieldController) })
        {
            var dependencies = controller.GetConstructors().SelectMany(item => item.GetParameters()).Select(item => item.ParameterType);
            Assert.DoesNotContain(typeof(IFeatureGateService), dependencies);
            Assert.DoesNotContain(dependencies, type => type.Name == "IUserService");
        }
    }

    [Theory]
    [InlineData("upgrade-required", EntitlementDecisionCategory.Upgrade, 403)]
    [InlineData("paused", EntitlementDecisionCategory.Unavailable, 403)]
    [InlineData("expired", EntitlementDecisionCategory.Unavailable, 403)]
    [InlineData("membership-invited", EntitlementDecisionCategory.Unauthorized, 403)]
    [InlineData("membership-removed", EntitlementDecisionCategory.Unauthorized, 403)]
    [InlineData("policy-error", EntitlementDecisionCategory.Unavailable, 503)]
    public async Task Rent_estimate_denial_is_stable_and_provider_is_never_called(
        string reason, EntitlementDecisionCategory category, int status)
    {
        var provider = new Mock<IRentEstimateService>(MockBehavior.Strict);
        var scope = new Mock<IEntitlementResourceOrganizationResolver>(MockBehavior.Strict);
        scope.Setup(item => item.GetPropertyOrganizationIdAsync(15, It.IsAny<CancellationToken>()))
            .ReturnsAsync(7L);
        var decision = new StubDecisionService(Denied(FeatureKeys.RentEstimate, reason, category));
        var controller = RentController(provider.Object, decision, scope.Object, userId: 42, organizationId: 7);

        var result = await controller.GetRentEstimate(15, 2, false, CancellationToken.None);

        Assert.Empty(provider.Invocations);
        var denied = Assert.IsType<ObjectResult>(result);
        Assert.Equal(status, denied.StatusCode);
        var body = Assert.IsType<EntitlementDeniedResponse>(denied.Value);
        Assert.Equal(FeatureKeys.RentEstimate.Value, body.FeatureKey);
        Assert.Equal(reason, body.ReasonCode);
        Assert.Equal(CategoryWire(category), body.Category);
    }

    [Fact]
    public async Task Rent_estimate_uses_trusted_numeric_scope_and_exact_property_organization()
    {
        var provider = new Mock<IRentEstimateService>(MockBehavior.Strict);
        provider.Setup(item => item.GetRentEstimateAsync(15, 2, 7, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RentEstimateResult.ProviderUnavailable());
        var scope = new Mock<IEntitlementResourceOrganizationResolver>(MockBehavior.Strict);
        scope.Setup(item => item.GetPropertyOrganizationIdAsync(15, It.IsAny<CancellationToken>())).ReturnsAsync(7L);
        var decision = new StubDecisionService(Allowed(FeatureKeys.RentEstimate));
        var controller = RentController(provider.Object, decision, scope.Object, 42, 7, isAdmin: true);

        await controller.GetRentEstimate(15, 2, false, CancellationToken.None);

        Assert.Equal("42", decision.Request!.AuthenticatedUserId);
        Assert.Equal(7, decision.Request.OrganizationId);
        Assert.Equal(7, decision.Request.ResourceOrganizationId);
        Assert.Equal(FeatureKeys.RentEstimate, decision.Request.Feature);
        provider.VerifyAll();
    }

    [Fact]
    public async Task LeaseShield_wrong_organization_denial_never_calls_operational_service()
    {
        var provider = new Mock<ILeaseShieldService>(MockBehavior.Strict);
        var scope = new Mock<IEntitlementResourceOrganizationResolver>(MockBehavior.Strict);
        scope.Setup(item => item.GetLeaseShieldConversationOrganizationIdAsync(91, 42, It.IsAny<CancellationToken>()))
            .ReturnsAsync(99L);
        var decision = new StubDecisionService(Denied(
            FeatureKeys.LeaseShieldRead,
            EntitlementReasonCodes.OrganizationMismatch.Value,
            EntitlementDecisionCategory.Unauthorized));
        var controller = LeaseController(provider.Object, decision, scope.Object, 42, 7);

        var result = await controller.GetConversation(91, CancellationToken.None);

        Assert.Empty(provider.Invocations);
        Assert.Equal(99, decision.Request!.ResourceOrganizationId);
        var denied = Assert.IsType<ObjectResult>(result);
        var body = Assert.IsType<EntitlementDeniedResponse>(denied.Value);
        Assert.Equal("organization-mismatch", body.ReasonCode);
        Assert.Equal("unauthorized", body.Category);
    }

    [Theory]
    [InlineData("upgrade-required", EntitlementDecisionCategory.Upgrade)]
    [InlineData("paused", EntitlementDecisionCategory.Unavailable)]
    [InlineData("expired", EntitlementDecisionCategory.Unavailable)]
    [InlineData("membership-invited", EntitlementDecisionCategory.Unauthorized)]
    [InlineData("membership-removed", EntitlementDecisionCategory.Unauthorized)]
    public async Task LeaseShield_create_denial_never_calls_operational_or_ai_service(
        string reason, EntitlementDecisionCategory category)
    {
        var provider = new Mock<ILeaseShieldService>(MockBehavior.Strict);
        var scope = new Mock<IEntitlementResourceOrganizationResolver>(MockBehavior.Strict);
        var decision = new StubDecisionService(Denied(FeatureKeys.LeaseShieldManage, reason, category));
        var controller = LeaseController(provider.Object, decision, scope.Object, 42, 7);

        var result = await controller.CreateConversation(new(), CancellationToken.None);

        Assert.Empty(provider.Invocations);
        var denied = Assert.IsType<ObjectResult>(result);
        var body = Assert.IsType<EntitlementDeniedResponse>(denied.Value);
        Assert.Equal(reason, body.ReasonCode);
    }

    [Fact]
    public async Task LeaseShield_allowed_admin_passes_selected_organization_to_service()
    {
        var provider = new Mock<ILeaseShieldService>(MockBehavior.Strict);
        provider.Setup(item => item.GetConversationsAsync(42, 7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(brownstone_hub_api.Models.ServiceResponse<List<brownstone_hub_api.Dtos.LeaseShield.LeaseShieldConversationListItemDto>>.CreateSuccess([]));
        var decision = new StubDecisionService(Allowed(FeatureKeys.LeaseShieldRead, PlanKeys.Lifetime));
        var controller = LeaseController(provider.Object, decision, new Mock<IEntitlementResourceOrganizationResolver>().Object, 42, 7, true);

        var result = await controller.GetConversations(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(FeatureKeys.LeaseShieldRead, decision.Request!.Feature);
        provider.VerifyAll();
    }

    [Theory]
    [InlineData(null, 7L, 401, "invalid-input")]
    [InlineData(42L, null, 403, "organization-required")]
    public async Task Trusted_scope_is_required_before_any_entitlement_or_provider_call(
        long? userId, long? organizationId, int status, string reason)
    {
        var provider = new Mock<ILeaseShieldService>(MockBehavior.Strict);
        var scope = new Mock<IEntitlementResourceOrganizationResolver>(MockBehavior.Strict);
        var decision = new StubDecisionService(Allowed(FeatureKeys.LeaseShieldRead));
        var controller = LeaseController(provider.Object, decision, scope.Object, userId, organizationId);

        var result = await controller.GetConversations(CancellationToken.None);

        Assert.Equal(0, decision.CallCount);
        Assert.Empty(provider.Invocations);
        Assert.Empty(scope.Invocations);
        var denied = Assert.IsType<ObjectResult>(result);
        Assert.Equal(status, denied.StatusCode);
        Assert.Equal(reason, Assert.IsType<EntitlementDeniedResponse>(denied.Value).ReasonCode);
    }

    private static RentEstimateController RentController(
        IRentEstimateService provider,
        IEntitlementDecisionService decision,
        IEntitlementResourceOrganizationResolver scope,
        long? userId,
        long? organizationId,
        bool isAdmin = false)
    {
        var controller = new RentEstimateController(provider, decision, scope, NullLogger<RentEstimateController>.Instance);
        SetContext(controller, userId, organizationId, isAdmin);
        return controller;
    }

    private static LeaseShieldController LeaseController(
        ILeaseShieldService provider,
        IEntitlementDecisionService decision,
        IEntitlementResourceOrganizationResolver scope,
        long? userId,
        long? organizationId,
        bool isAdmin = false)
    {
        var controller = new LeaseShieldController(provider, decision, scope, NullLogger<LeaseShieldController>.Instance);
        SetContext(controller, userId, organizationId, isAdmin);
        return controller;
    }

    private static void SetContext(ControllerBase controller, long? userId, long? organizationId, bool isAdmin)
    {
        var http = new DefaultHttpContext();
        if (userId.HasValue) http.Items["UserId"] = userId.Value;
        if (organizationId.HasValue) http.Items["OrganizationId"] = organizationId.Value;
        if (isAdmin) http.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "Admin")], "test"));
        controller.ControllerContext = new ControllerContext { HttpContext = http };
    }

    private static UnifiedEntitlementDecision Allowed(FeatureKey feature, PlanKey? plan = null) =>
        new(true, EntitlementDecisionCategory.Allowed, EntitlementCatalog.Version, feature, plan ?? PlanKeys.Premium, EntitlementReasonCodes.Allowed);

    private static UnifiedEntitlementDecision Denied(FeatureKey feature, string reason, EntitlementDecisionCategory category) =>
        new(false, category, EntitlementCatalog.Version, feature, null, new EntitlementReasonCode(reason));

    private static string CategoryWire(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "upgrade",
        EntitlementDecisionCategory.Setup => "setup",
        EntitlementDecisionCategory.Unauthorized => "unauthorized",
        EntitlementDecisionCategory.Allowed => "allowed",
        _ => "unavailable"
    };

    private sealed class StubDecisionService(UnifiedEntitlementDecision decision) : IEntitlementDecisionService
    {
        public int CallCount { get; private set; }
        public EntitlementDecisionRequest? Request { get; private set; }

        public Task<UnifiedEntitlementDecision> DecideAsync(EntitlementDecisionRequest request, CancellationToken cancellationToken = default)
        {
            CallCount++;
            Request = request;
            return Task.FromResult(decision);
        }
    }
}
