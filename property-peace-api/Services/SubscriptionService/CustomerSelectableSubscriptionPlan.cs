using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.SubscriptionService;

/// <summary>
/// Stable allow-list for plans that may cross a public/customer plan-selection boundary.
/// Administrative assignment paths intentionally do not use this policy.
/// </summary>
public static class CustomerSelectableSubscriptionPlan
{
    public static bool IsSelectable(SubscriptionPlan? plan)
    {
        if (plan == null || !plan.IsActive || plan.IsTrial || plan.TrialDays.GetValueOrDefault() > 0)
        {
            return false;
        }

        var normalizedName = plan.Name?.Trim();
        return string.Equals(normalizedName, "Free", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalizedName, "Premium", StringComparison.OrdinalIgnoreCase);
    }
}
