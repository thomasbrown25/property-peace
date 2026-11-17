namespace brownstone_hub_api.Services.SubscriptionService;

public sealed record ListingSyndicationEntitlement(
    bool CanUseCoreDestinations,
    bool CanUseExtendedDestinations,
    int? MaxActiveExternalListings)
{
    public static ListingSyndicationEntitlement None { get; } = new(false, false, 0);
}

public static class ListingSyndicationPlanPolicy
{
    public static ListingSyndicationEntitlement Resolve(
        string? planName,
        string? billingCycle,
        bool isActive)
    {
        if (!isActive)
            return ListingSyndicationEntitlement.None;

        var normalizedPlanName = planName?.Trim() ?? string.Empty;
        // Billing-cycle metadata is not plan authority; only recognized persisted plans grant access.
        var isPremiumOrLifetime =
            string.Equals(normalizedPlanName, "Premium", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedPlanName, "Premium Plan", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedPlanName, "Lifetime Plan", StringComparison.OrdinalIgnoreCase);

        if (isPremiumOrLifetime)
            return new ListingSyndicationEntitlement(true, true, null);

        if (string.Equals(normalizedPlanName, "Free", StringComparison.OrdinalIgnoreCase))
            return new ListingSyndicationEntitlement(true, true, null);

        return ListingSyndicationEntitlement.None;
    }
}
