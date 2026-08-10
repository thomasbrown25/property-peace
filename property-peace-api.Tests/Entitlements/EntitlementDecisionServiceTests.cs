using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class EntitlementDecisionServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Explicit_identity_and_organization_are_required_before_provider_access()
    {
        var provider = new FakeFactsProvider(StandardFacts());
        var service = Service(provider);

        var missingUser = await service.DecideAsync(Request(userId: " "));
        var missingOrganization = await service.DecideAsync(Request(organizationId: 0));
        var malformedQuantity = await service.DecideAsync(Request(requestedQuantity: 0));

        Assert.Equal(EntitlementReasonCodes.InvalidInput, missingUser.Reason);
        Assert.Equal(EntitlementReasonCodes.OrganizationRequired, missingOrganization.Reason);
        Assert.Equal(EntitlementReasonCodes.InvalidInput, malformedQuantity.Reason);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task Optional_quantity_and_resource_scope_may_be_omitted_for_read_and_report_decisions()
    {
        var provider = new FakeFactsProvider(StandardFacts());

        var decision = await Service(provider).DecideAsync(Request(
            feature: FeatureKeys.AdvancedReporting,
            requestedQuantity: null,
            resourceOrganizationId: null));

        Assert.True(decision.IsAllowed);
        Assert.Equal(EntitlementDecisionCategory.Allowed, decision.Category);
        Assert.Equal(1, provider.CallCount);
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(-1, null)]
    [InlineData(null, 0)]
    [InlineData(null, -1)]
    public async Task Invalid_provided_quantity_or_resource_scope_fails_before_provider_access(
        int? requestedQuantity,
        int? resourceOrganizationId)
    {
        var provider = new FakeFactsProvider(StandardFacts());

        var decision = await Service(provider).DecideAsync(Request(
            requestedQuantity: requestedQuantity,
            resourceOrganizationId: resourceOrganizationId.HasValue ? (long)resourceOrganizationId.Value : null));

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.InvalidInput, decision.Reason);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task Unknown_feature_fails_closed_before_provider_access()
    {
        var provider = new FakeFactsProvider(StandardFacts());
        var service = Service(provider);

        var feature = await service.DecideAsync(Request(feature: new FeatureKey("not-catalogued")));

        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, feature.Reason);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task Pre_canceled_token_is_propagated_without_provider_access()
    {
        var provider = new FakeFactsProvider(StandardFacts());
        using var source = new CancellationTokenSource();
        source.Cancel();

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Service(provider).DecideAsync(Request(), source.Token));

        Assert.Equal(source.Token, exception.CancellationToken);
        Assert.Equal(0, provider.CallCount);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Provider_cancellation_is_propagated(bool taskCanceled)
    {
        using var source = new CancellationTokenSource();
        var provider = new CancelingFactsProvider(taskCanceled);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Service(provider).DecideAsync(Request(), source.Token));
    }

    [Fact]
    public async Task Provider_receives_only_the_explicit_user_and_organization()
    {
        var provider = new FakeFactsProvider(StandardFacts());

        await Service(provider).DecideAsync(Request(userId: "user-42", organizationId: 42));

        Assert.Equal("user-42", provider.LastUserId);
        Assert.Equal(42, provider.LastOrganizationId);
        Assert.Equal(FeatureKeys.PropertyManagement, provider.LastFeature);
    }

    [Theory]
    [InlineData(MembershipState.Missing, "membership-required")]
    [InlineData(MembershipState.Invited, "membership-invited")]
    [InlineData(MembershipState.Inactive, "membership-inactive")]
    [InlineData(MembershipState.Removed, "membership-removed")]
    public async Task Membership_states_deny_before_subscription_policy(MembershipState state, string reason)
    {
        var facts = StandardFacts() with
        {
            Membership = Member(state),
            Subscription = Subscription(status: "DefinitelyUnknown")
        };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request());

        Assert.False(decision.IsAllowed);
        Assert.Equal(reason, decision.Reason.Value);
        Assert.Equal(EntitlementDecisionCategory.Unauthorized, decision.Category);
    }

    [Fact]
    public async Task Wrong_organization_membership_denies_without_admin_bypass()
    {
        var facts = StandardFacts() with
        {
            AuthenticatedUserId = "platform-admin",
            Membership = Member(MembershipState.Active) with { OrganizationId = 99 }
        };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request(userId: "platform-admin"));

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.OrganizationMismatch, decision.Reason);
        Assert.Equal(EntitlementDecisionCategory.Unauthorized, decision.Category);
    }

    [Theory]
    [InlineData("Paused", "paused")]
    [InlineData("PastDue", "expired")]
    [InlineData("Inactive", "inactive")]
    [InlineData("Mystery", "unknown-policy")]
    public async Task Subscription_lifecycle_precedes_plan_mapping(string status, string reason)
    {
        var facts = StandardFacts() with { Subscription = Subscription(plan: "Enterprise", status: status) };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request());

        Assert.Equal(reason, decision.Reason.Value);
        Assert.Null(decision.EffectivePlan);
    }

    [Fact]
    public async Task Unknown_persisted_plan_denies_after_valid_lifecycle()
    {
        var facts = StandardFacts() with { Subscription = Subscription(plan: "Enterprise") };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request());

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
        Assert.Null(decision.EffectivePlan);
    }

    [Theory]
    [InlineData("Free", "free", false, "upgrade-required")]
    [InlineData("Premium", "premium", true, "allowed")]
    [InlineData("Lifetime Plan", "lifetime", true, "allowed")]
    public async Task Free_premium_and_lifetime_use_the_catalog(string persistedPlan, string effectivePlan, bool allowed, string reason)
    {
        var facts = StandardFacts() with { Subscription = Subscription(plan: persistedPlan) };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request(feature: FeatureKeys.AdvancedReporting));

        Assert.Equal(allowed, decision.IsAllowed);
        Assert.Equal(reason, decision.Reason.Value);
        Assert.Equal(new PlanKey(effectivePlan), decision.EffectivePlan);
        Assert.Equal(EntitlementCatalog.Version, decision.MatrixVersion);
        Assert.Equal(FeatureKeys.AdvancedReporting, decision.Feature);
    }

    [Fact]
    public async Task Quota_applies_current_usage_and_requested_quantity()
    {
        var below = StandardFacts(plan: "Free") with { CurrentUsage = 4 };
        var atLimit = StandardFacts(plan: "Free") with { CurrentUsage = 5 };

        var allowed = await Service(new FakeFactsProvider(below)).DecideAsync(Request(requestedQuantity: 1));
        var deniedByRequest = await Service(new FakeFactsProvider(below)).DecideAsync(Request(requestedQuantity: 2));
        var deniedByUsage = await Service(new FakeFactsProvider(atLimit)).DecideAsync(Request(requestedQuantity: 1));

        Assert.True(allowed.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Quota, deniedByRequest.Reason);
        Assert.Equal(EntitlementReasonCodes.Quota, deniedByUsage.Reason);
        Assert.Equal(new EntitlementQuota("units", 5), deniedByRequest.Quota);
    }

    [Fact]
    public async Task Requested_quantity_and_usage_use_long_safe_arithmetic_at_int_boundaries()
    {
        var noUsage = StandardFacts(plan: "Free") with { CurrentUsage = 0 };
        var maximumUsage = StandardFacts(plan: "Free") with { CurrentUsage = int.MaxValue };

        var maximumRequest = await Service(new FakeFactsProvider(noUsage)).DecideAsync(
            Request(requestedQuantity: int.MaxValue));
        var maximumCurrentUsage = await Service(new FakeFactsProvider(maximumUsage)).DecideAsync(
            Request(requestedQuantity: int.MaxValue));

        Assert.Equal(EntitlementReasonCodes.Quota, maximumRequest.Reason);
        Assert.Equal(EntitlementReasonCodes.Quota, maximumCurrentUsage.Reason);
    }

    [Fact]
    public async Task Sms_readiness_is_preserved_without_paid_add_on_diagnostics()
    {
        var notReady = StandardFacts() with
        {
            Readiness = new Dictionary<ReadinessDependencyKey, bool>
            {
                [ReadinessDependencyKeys.SmsNumberConfigured] = false
            }
        };
        var ready = notReady with
        {
            Readiness = new Dictionary<ReadinessDependencyKey, bool>
            {
                [ReadinessDependencyKeys.SmsNumberConfigured] = true
            }
        };

        var setup = await Service(new FakeFactsProvider(notReady)).DecideAsync(Request(feature: FeatureKeys.SmsMessaging));
        var allowed = await Service(new FakeFactsProvider(ready)).DecideAsync(Request(feature: FeatureKeys.SmsMessaging));

        Assert.Equal(EntitlementReasonCodes.SetupRequired, setup.Reason);
        Assert.Equal(EntitlementDecisionCategory.Setup, setup.Category);
        Assert.True(allowed.IsAllowed);
        Assert.NotNull(setup.Diagnostics);
        Assert.NotNull(setup.ReadinessDependencies);
        Assert.Equal([ReadinessDependencyKeys.SmsNumberConfigured], setup.ReadinessDependencies);
        Assert.Empty(setup.RequiredAddOns);
        Assert.Throws<NotSupportedException>(() => Assert.IsAssignableFrom<IList<string>>(setup.Diagnostics).Clear());
        Assert.Throws<NotSupportedException>(() => Assert.IsAssignableFrom<IList<ReadinessDependencyKey>>(setup.ReadinessDependencies).Clear());
    }

    [Fact]
    public async Task Resource_mismatch_overrides_and_hides_quota_and_readiness_detail()
    {
        var facts = StandardFacts() with
        {
            CurrentUsage = 1,
            Readiness = new Dictionary<ReadinessDependencyKey, bool>
            {
                [ReadinessDependencyKeys.SmsNumberConfigured] = false
            }
        };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(
            Request(feature: FeatureKeys.SmsMessaging, resourceOrganizationId: 99));

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.OrganizationMismatch, decision.Reason);
        Assert.Null(decision.Quota);
        Assert.Empty(decision.RequiredAddOns);
        Assert.Empty(decision.ReadinessDependencies);
        Assert.Empty(decision.Diagnostics);
    }

    [Theory]
    [InlineData("missing-subscription")]
    [InlineData("invalid-lifecycle")]
    [InlineData("unknown-plan")]
    public async Task Resource_mismatch_is_checked_after_authority_but_before_sensitive_entitlement_policy(string scenario)
    {
        var facts = StandardFacts() with
        {
            Subscription = scenario switch
            {
                "missing-subscription" => null,
                "invalid-lifecycle" => Subscription(status: "Paused"),
                "unknown-plan" => Subscription(plan: "Enterprise"),
                _ => throw new InvalidOperationException()
            }
        };
        var provider = new FakeFactsProvider(facts);

        var decision = await Service(provider).DecideAsync(Request(resourceOrganizationId: 99));

        Assert.Equal(1, provider.CallCount);
        Assert.Equal(EntitlementReasonCodes.OrganizationMismatch, decision.Reason);
        Assert.Null(decision.EffectivePlan);
        Assert.Null(decision.Quota);
        Assert.Empty(decision.RequiredAddOns);
        Assert.Empty(decision.ReadinessDependencies);
        Assert.Empty(decision.Diagnostics);
    }

    [Fact]
    public async Task Resource_mismatch_does_not_bypass_caller_authority_validation()
    {
        var facts = StandardFacts() with { Membership = Member(MembershipState.Invited) };
        var provider = new FakeFactsProvider(facts);

        var decision = await Service(provider).DecideAsync(Request(resourceOrganizationId: 99));

        Assert.Equal(1, provider.CallCount);
        Assert.Equal(EntitlementReasonCodes.MembershipInvited, decision.Reason);
    }

    [Theory]
    [InlineData("different-user")]
    [InlineData("USER-1")]
    public async Task Facts_are_bound_exactly_to_the_authenticated_subject(string returnedSubject)
    {
        var facts = StandardFacts() with { AuthenticatedUserId = returnedSubject };

        var decision = await Service(new FakeFactsProvider(facts)).DecideAsync(Request(userId: "user-1"));

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.SubjectMismatch, decision.Reason);
        Assert.Equal(EntitlementDecisionCategory.Unauthorized, decision.Category);
        Assert.Null(decision.EffectivePlan);
        Assert.Empty(decision.Diagnostics);
    }

    [Fact]
    public async Task Request_has_no_caller_bindable_authority_requirement_and_catalog_policy_cannot_be_downgraded()
    {
        Assert.Null(typeof(EntitlementDecisionRequest).GetProperty("AuthorityRequirement"));
        var viewerFacts = StandardFacts() with
        {
            Membership = new OrganizationMembershipFacts(
                42, MembershipState.Active, OrganizationRole.Viewer, "Viewer", [])
        };

        var decision = await Service(new FakeFactsProvider(viewerFacts)).DecideAsync(
            Request(feature: FeatureKeys.PropertyManagement));

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Unauthorized, decision.Reason);
    }

    [Fact]
    public async Task Missing_or_cross_organization_facts_fail_closed_with_stable_reasons()
    {
        var missingFacts = await Service(new FakeFactsProvider(null)).DecideAsync(Request());
        var missingOrganization = await Service(new FakeFactsProvider(StandardFacts() with { Organization = null })).DecideAsync(Request());
        var missingMembership = await Service(new FakeFactsProvider(StandardFacts() with { Membership = null })).DecideAsync(Request());
        var missingSubscription = await Service(new FakeFactsProvider(StandardFacts() with { Subscription = null })).DecideAsync(Request());
        var wrongSubscription = await Service(new FakeFactsProvider(StandardFacts() with
        {
            Subscription = Subscription() with { OrganizationId = 99 }
        })).DecideAsync(Request());

        Assert.Equal(EntitlementReasonCodes.FactsUnavailable, missingFacts.Reason);
        Assert.Equal(EntitlementReasonCodes.OrganizationRequired, missingOrganization.Reason);
        Assert.Equal(EntitlementReasonCodes.MembershipRequired, missingMembership.Reason);
        Assert.Equal(EntitlementReasonCodes.SubscriptionMissing, missingSubscription.Reason);
        Assert.Equal(EntitlementReasonCodes.OrganizationMismatch, wrongSubscription.Reason);
    }

    [Fact]
    public async Task Provider_and_policy_exceptions_fail_closed_without_leaking_details()
    {
        var failedProvider = await Service(new ThrowingFactsProvider()).DecideAsync(Request());
        var badMembership = StandardFacts() with
        {
            Membership = new OrganizationMembershipFacts(
                42,
                MembershipState.Active,
                OrganizationRole.Manager,
                "Manager",
                new ThrowingPermissions())
        };
        var failedPolicy = await Service(new FakeFactsProvider(badMembership)).DecideAsync(Request());

        Assert.Equal(EntitlementReasonCodes.PolicyError, failedProvider.Reason);
        Assert.Equal(EntitlementReasonCodes.PolicyError, failedPolicy.Reason);
        Assert.Equal(EntitlementDecisionCategory.Unavailable, failedProvider.Category);
        Assert.Empty(failedProvider.Diagnostics);
        Assert.Empty(failedPolicy.Diagnostics);
    }

    private static EntitlementDecisionService Service(IEntitlementDecisionFactsProvider provider) =>
        new(provider, new FixedTimeProvider(Now));

    private static EntitlementDecisionRequest Request(
        string userId = "user-1",
        long organizationId = 42,
        FeatureKey? feature = null,
        int? requestedQuantity = null,
        long? resourceOrganizationId = null) =>
        new(
            userId,
            organizationId,
            feature ?? FeatureKeys.PropertyManagement,
            requestedQuantity,
            resourceOrganizationId);

    private static EntitlementDecisionFacts StandardFacts(string plan = "Premium") =>
        new(
            "user-1",
            new OrganizationAuthorityFacts(42, Exists: true, IsActive: true, IsDeleted: false),
            Member(MembershipState.Active),
            Subscription(plan),
            CurrentUsage: 0,
            ActiveAddOns: new HashSet<AddOnKey>(),
            Readiness: new Dictionary<ReadinessDependencyKey, bool>());

    private static OrganizationMembershipFacts Member(MembershipState state) =>
        new(42, state, OrganizationRole.Owner, "Owner", []);

    private static OrganizationSubscriptionFacts Subscription(string plan = "Premium", string status = "Active") =>
        new(42, plan, new SubscriptionLifecycleFacts(status, CurrentPeriodEnd: Now.AddMonths(1)));

    private sealed class FakeFactsProvider(EntitlementDecisionFacts? facts) : IEntitlementDecisionFactsProvider
    {
        public int CallCount { get; private set; }
        public string? LastUserId { get; private set; }
        public long? LastOrganizationId { get; private set; }
        public FeatureKey? LastFeature { get; private set; }

        public Task<EntitlementDecisionFacts?> GetFactsAsync(
            string authenticatedUserId,
            long organizationId,
            FeatureKey feature,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            LastUserId = authenticatedUserId;
            LastOrganizationId = organizationId;
            LastFeature = feature;
            return Task.FromResult(facts);
        }
    }

    private sealed class ThrowingFactsProvider : IEntitlementDecisionFactsProvider
    {
        public Task<EntitlementDecisionFacts?> GetFactsAsync(
            string authenticatedUserId,
            long organizationId,
            FeatureKey feature,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("repository unavailable");
    }

    private sealed class CancelingFactsProvider(bool taskCanceled) : IEntitlementDecisionFactsProvider
    {
        public Task<EntitlementDecisionFacts?> GetFactsAsync(
            string authenticatedUserId,
            long organizationId,
            FeatureKey feature,
            CancellationToken cancellationToken = default) =>
            taskCanceled
                ? Task.FromException<EntitlementDecisionFacts?>(new TaskCanceledException("provider canceled"))
                : Task.FromException<EntitlementDecisionFacts?>(new OperationCanceledException(cancellationToken));
    }

    private sealed class ThrowingPermissions : IReadOnlyCollection<OrganizationPermission>
    {
        public int Count => 1;

        public IEnumerator<OrganizationPermission> GetEnumerator() =>
            throw new InvalidOperationException("malformed policy facts");

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
