namespace brownstone_hub_api.Entitlements.Policy;

public enum SubscriptionLifecycleState
{
    Unknown = 0,
    Active = 1,
    Trial = 2,
    PaymentPending = 3,
    CancellationPending = 4,
    Paused = 5,
    Expired = 6,
    Inactive = 7
}

public sealed record SubscriptionLifecycleFacts(
    string? Status,
    DateTimeOffset? CurrentPeriodEnd = null,
    DateTimeOffset? TrialEnd = null,
    bool CancelAtPeriodEnd = false,
    bool PauseAtPeriodEnd = false,
    DateTimeOffset? CancelledAt = null,
    DateTimeOffset? PausedAt = null);

public sealed record SubscriptionLifecycleDecision(
    bool IsAllowed,
    SubscriptionLifecycleState State,
    EntitlementReasonCode Reason);

public static class SubscriptionLifecyclePolicy
{
    public static SubscriptionLifecycleDecision Evaluate(
        SubscriptionLifecycleFacts facts,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(facts);

        if (facts.CancelledAt is not null && facts.CancelledAt <= now)
        {
            return Denied(SubscriptionLifecycleState.Expired, EntitlementReasonCodes.Expired);
        }

        if (facts.PausedAt is not null && facts.PausedAt <= now)
        {
            return Denied(SubscriptionLifecycleState.Paused, EntitlementReasonCodes.Paused);
        }

        if (facts.PauseAtPeriodEnd && facts.CancelAtPeriodEnd)
        {
            return Denied(SubscriptionLifecycleState.Unknown, EntitlementReasonCodes.UnknownPolicy);
        }

        if ((facts.PauseAtPeriodEnd || facts.CancelAtPeriodEnd) && facts.CurrentPeriodEnd is null)
        {
            return Denied(SubscriptionLifecycleState.Unknown, EntitlementReasonCodes.UnknownPolicy);
        }

        if (facts.PauseAtPeriodEnd && HasReached(facts.CurrentPeriodEnd, now))
        {
            return Denied(SubscriptionLifecycleState.Paused, EntitlementReasonCodes.Paused);
        }

        if (facts.CancelAtPeriodEnd && HasReached(facts.CurrentPeriodEnd, now))
        {
            return Denied(SubscriptionLifecycleState.Expired, EntitlementReasonCodes.Expired);
        }

        if (string.Equals(facts.Status, "Paused", StringComparison.OrdinalIgnoreCase))
        {
            return Denied(SubscriptionLifecycleState.Paused, EntitlementReasonCodes.Paused);
        }

        if (string.Equals(facts.Status, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(facts.Status, "Canceled", StringComparison.OrdinalIgnoreCase))
        {
            if (facts.CurrentPeriodEnd is null)
            {
                return Denied(SubscriptionLifecycleState.Unknown, EntitlementReasonCodes.UnknownPolicy);
            }

            return facts.CurrentPeriodEnd > now
                ? Allowed(SubscriptionLifecycleState.CancellationPending)
                : Denied(SubscriptionLifecycleState.Expired, EntitlementReasonCodes.Expired);
        }

        if (string.Equals(facts.Status, "Trial", StringComparison.OrdinalIgnoreCase))
        {
            if (facts.TrialEnd is null)
            {
                return Denied(SubscriptionLifecycleState.Unknown, EntitlementReasonCodes.UnknownPolicy);
            }

            return facts.TrialEnd > now
                ? Allowed(SubscriptionLifecycleState.Trial)
                : Denied(SubscriptionLifecycleState.Expired, EntitlementReasonCodes.Expired);
        }

        if (string.Equals(facts.Status, "Active", StringComparison.OrdinalIgnoreCase))
        {
            return Allowed(SubscriptionLifecycleState.Active);
        }

        if (string.Equals(facts.Status, "PaymentPending", StringComparison.OrdinalIgnoreCase))
        {
            return Allowed(SubscriptionLifecycleState.PaymentPending);
        }

        if (string.Equals(facts.Status, "PastDue", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(facts.Status, "Unpaid", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(facts.Status, "Expired", StringComparison.OrdinalIgnoreCase))
        {
            return Denied(SubscriptionLifecycleState.Expired, EntitlementReasonCodes.Expired);
        }

        if (string.Equals(facts.Status, "Inactive", StringComparison.OrdinalIgnoreCase))
        {
            return Denied(SubscriptionLifecycleState.Inactive, EntitlementReasonCodes.Inactive);
        }

        return Denied(SubscriptionLifecycleState.Unknown, EntitlementReasonCodes.UnknownPolicy);
    }

    private static bool HasReached(DateTimeOffset? cutoff, DateTimeOffset now) =>
        cutoff.HasValue && cutoff.Value <= now;

    private static SubscriptionLifecycleDecision Allowed(SubscriptionLifecycleState state) =>
        new(true, state, EntitlementReasonCodes.Allowed);

    private static SubscriptionLifecycleDecision Denied(
        SubscriptionLifecycleState state,
        EntitlementReasonCode reason) => new(false, state, reason);
}
