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
        var normalizedBillingCycle = billingCycle?.Trim() ?? string.Empty;
        var isPremiumOrLifetime =
            normalizedPlanName.Contains("premium", StringComparison.OrdinalIgnoreCase) ||
            normalizedPlanName.Contains("lifetime", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(normalizedBillingCycle, "Lifetime", StringComparison.OrdinalIgnoreCase);

        if (isPremiumOrLifetime)
            return new ListingSyndicationEntitlement(true, true, null);

        if (string.Equals(normalizedPlanName, "Free", StringComparison.OrdinalIgnoreCase))
            return new ListingSyndicationEntitlement(true, false, 1);

        return ListingSyndicationEntitlement.None;
    }
}
