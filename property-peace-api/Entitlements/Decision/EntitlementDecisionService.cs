using brownstone_hub_api.Entitlements.Policy;

namespace brownstone_hub_api.Entitlements.Decision;

public sealed class EntitlementDecisionService(
    IEntitlementDecisionFactsProvider factsProvider,
    TimeProvider timeProvider) : IEntitlementDecisionService
{
    public async Task<UnifiedEntitlementDecision> DecideAsync(
        EntitlementDecisionRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (request is null)
        {
            return Denied(default, EntitlementReasonCodes.InvalidInput);
        }

        var inputDenial = ValidateInputAndPolicy(request);
        if (inputDenial is not null)
        {
            return inputDenial;
        }

        EntitlementDecisionFacts? facts;
        try
        {
            facts = await factsProvider.GetFactsAsync(
                request.AuthenticatedUserId,
                request.OrganizationId,
                request.Feature,
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            return Denied(request.Feature, EntitlementReasonCodes.PolicyError);
        }

        if (facts is null)
        {
            return Denied(request.Feature, EntitlementReasonCodes.FactsUnavailable);
        }

        if (!string.Equals(
                facts.AuthenticatedUserId,
                request.AuthenticatedUserId,
                StringComparison.Ordinal))
        {
            return Denied(request.Feature, EntitlementReasonCodes.SubjectMismatch);
        }

        UnifiedEntitlementDecision? authorityDenial;
        try
        {
            authorityDenial = EvaluateAuthority(request, facts);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            return Denied(request.Feature, EntitlementReasonCodes.PolicyError);
        }

        if (authorityDenial is not null)
        {
            return authorityDenial;
        }

        // Validate the caller against the requested organization before comparing resource scope.
        // Once mismatched, suppress all subscription and catalog-derived information.
        if (request.ResourceOrganizationId.HasValue &&
            request.ResourceOrganizationId.Value != request.OrganizationId)
        {
            return Denied(request.Feature, EntitlementReasonCodes.OrganizationMismatch);
        }

        var subscription = facts.Subscription;
        if (subscription is null)
        {
            return Denied(request.Feature, EntitlementReasonCodes.SubscriptionMissing);
        }

        if (subscription.OrganizationId != request.OrganizationId)
        {
            return Denied(request.Feature, EntitlementReasonCodes.OrganizationMismatch);
        }

        if (subscription.Lifecycle is null)
        {
            return Denied(request.Feature, EntitlementReasonCodes.FactsUnavailable);
        }

        SubscriptionLifecycleDecision lifecycle;
        try
        {
            lifecycle = SubscriptionLifecyclePolicy.Evaluate(subscription.Lifecycle, timeProvider.GetUtcNow());
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            return Denied(request.Feature, EntitlementReasonCodes.PolicyError);
        }

        if (!lifecycle.IsAllowed)
        {
            return Denied(request.Feature, lifecycle.Reason);
        }

        if (!PlanKeyMapping.TryFromPersistedName(subscription.PersistedPlanName, out var plan))
        {
            return Denied(request.Feature, EntitlementReasonCodes.UnknownPolicy);
        }

        EntitlementDecision catalog;
        try
        {
            catalog = EntitlementCatalog.Evaluate(
                request.Feature,
                plan,
                new EntitlementEvaluationFacts(facts.CurrentUsage, facts.ActiveAddOns, facts.Readiness));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            return Denied(request.Feature, EntitlementReasonCodes.PolicyError, plan);
        }

        if (catalog.Quota is not null &&
            request.RequestedQuantity.HasValue &&
            facts.CurrentUsage.HasValue &&
            (long)facts.CurrentUsage.Value + request.RequestedQuantity.Value > catalog.Quota.Limit)
        {
            catalog = new EntitlementDecision(
                false,
                EntitlementReasonCodes.Quota,
                catalog.Quota,
                catalog.RequiredAddOns,
                catalog.ReadinessDependencies);
        }

        return FromCatalog(request.Feature, plan, catalog);
    }

    private static UnifiedEntitlementDecision? ValidateInputAndPolicy(EntitlementDecisionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AuthenticatedUserId))
        {
            return Denied(request.Feature, EntitlementReasonCodes.InvalidInput);
        }

        if (request.OrganizationId <= 0)
        {
            return Denied(request.Feature, EntitlementReasonCodes.OrganizationRequired);
        }

        if ((request.ResourceOrganizationId.HasValue && request.ResourceOrganizationId.Value <= 0) ||
            (request.RequestedQuantity.HasValue && request.RequestedQuantity.Value <= 0))
        {
            return Denied(request.Feature, EntitlementReasonCodes.InvalidInput);
        }

        if (!EntitlementCatalog.Features.Any(feature => feature.Key == request.Feature))
        {
            return Denied(request.Feature, EntitlementReasonCodes.UnknownPolicy);
        }

        return null;
    }

    private static UnifiedEntitlementDecision? EvaluateAuthority(
        EntitlementDecisionRequest request,
        EntitlementDecisionFacts facts)
    {
        if (facts.Organization is null || !facts.Organization.Exists)
        {
            return Denied(request.Feature, EntitlementReasonCodes.OrganizationRequired);
        }

        if (facts.Organization.OrganizationId != request.OrganizationId)
        {
            return Denied(request.Feature, EntitlementReasonCodes.OrganizationMismatch);
        }

        if (facts.Membership is null)
        {
            return Denied(request.Feature, EntitlementReasonCodes.MembershipRequired);
        }

        var authorityRequirement = EntitlementCatalog.Features
            .Single(feature => feature.Key == request.Feature)
            .AuthorityRequirement;
        var authority = OrganizationAuthorityPolicy.Evaluate(
            facts.Organization,
            facts.Membership,
            authorityRequirement);

        if (authority.IsAllowed)
        {
            return null;
        }

        var reason = authority.Outcome switch
        {
            OrganizationAuthorityOutcome.MissingOrganization => EntitlementReasonCodes.OrganizationRequired,
            OrganizationAuthorityOutcome.WrongOrganization => EntitlementReasonCodes.OrganizationMismatch,
            OrganizationAuthorityOutcome.MissingMember => EntitlementReasonCodes.MembershipRequired,
            OrganizationAuthorityOutcome.Invited => EntitlementReasonCodes.MembershipInvited,
            OrganizationAuthorityOutcome.InactiveMember => EntitlementReasonCodes.MembershipInactive,
            OrganizationAuthorityOutcome.RemovedMember => EntitlementReasonCodes.MembershipRemoved,
            _ => authority.Reason
        };

        return Denied(request.Feature, reason);
    }

    private static UnifiedEntitlementDecision FromCatalog(
        FeatureKey feature,
        PlanKey plan,
        EntitlementDecision catalog)
    {
        var diagnostics = new List<string>();
        if (catalog.Quota is not null)
        {
            diagnostics.Add($"quota:{catalog.Quota.Unit}:{catalog.Quota.Limit}");
        }

        diagnostics.AddRange(catalog.RequiredAddOns.Select(item => $"add-on:{item.Value}"));
        diagnostics.AddRange(catalog.ReadinessDependencies.Select(item => $"readiness:{item.Value}"));

        return new UnifiedEntitlementDecision(
            catalog.IsAllowed,
            Category(catalog.IsAllowed, catalog.Reason),
            EntitlementCatalog.Version,
            feature,
            plan,
            catalog.Reason,
            catalog.Quota,
            catalog.RequiredAddOns,
            catalog.ReadinessDependencies,
            diagnostics);
    }

    private static UnifiedEntitlementDecision Denied(
        FeatureKey feature,
        EntitlementReasonCode reason,
        PlanKey? plan = null) =>
        new(
            false,
            Category(false, reason),
            EntitlementCatalog.Version,
            feature,
            plan,
            reason);

    private static EntitlementDecisionCategory Category(bool allowed, EntitlementReasonCode reason)
    {
        if (allowed)
        {
            return EntitlementDecisionCategory.Allowed;
        }

        if (reason == EntitlementReasonCodes.UpgradeRequired || reason == EntitlementReasonCodes.Quota)
        {
            return EntitlementDecisionCategory.Upgrade;
        }

        if (reason == EntitlementReasonCodes.SetupRequired)
        {
            return EntitlementDecisionCategory.Setup;
        }

        if (reason == EntitlementReasonCodes.Unauthorized ||
            reason == EntitlementReasonCodes.OrganizationMismatch ||
            reason == EntitlementReasonCodes.SubjectMismatch ||
            reason == EntitlementReasonCodes.MembershipRequired ||
            reason == EntitlementReasonCodes.MembershipInvited ||
            reason == EntitlementReasonCodes.MembershipInactive ||
            reason == EntitlementReasonCodes.MembershipRemoved)
        {
            return EntitlementDecisionCategory.Unauthorized;
        }

        return EntitlementDecisionCategory.Unavailable;
    }
}
