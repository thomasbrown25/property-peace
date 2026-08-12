using brownstone_hub_api.Entitlements.Policy;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class SubscriptionLifecyclePolicyTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("Active", SubscriptionLifecycleState.Active)]
    [InlineData("Trial", SubscriptionLifecycleState.Trial)]
    [InlineData("PaymentPending", SubscriptionLifecycleState.PaymentPending)]
    public void Access_states_are_allowed_explicitly(string status, SubscriptionLifecycleState expectedState)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts(status, CurrentPeriodEnd: Now.AddDays(1), TrialEnd: Now.AddDays(1)),
            Now);

        Assert.True(result.IsAllowed);
        Assert.Equal(expectedState, result.State);
        Assert.Equal(EntitlementReasonCodes.Allowed, result.Reason);
    }

    [Fact]
    public void Trial_at_cutoff_is_expired()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Trial", TrialEnd: Now),
            Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Expired, result.State);
        Assert.Equal(EntitlementReasonCodes.Expired, result.Reason);
    }

    [Fact]
    public void Trial_without_an_end_fails_closed_as_unknown_policy()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts("Trial"), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Unknown, result.State);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, result.Reason);
    }

    [Fact]
    public void Contradictory_scheduled_pause_and_cancellation_fail_closed_even_before_cutoff()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts(
                "Active",
                CurrentPeriodEnd: Now.AddDays(1),
                CancelAtPeriodEnd: true,
                PauseAtPeriodEnd: true),
            Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Unknown, result.State);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, result.Reason);
    }

    [Fact]
    public void Effective_cancellation_takes_conservative_precedence_over_effective_pause()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CancelledAt: Now, PausedAt: Now),
            Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Expired, result.State);
        Assert.Equal(EntitlementReasonCodes.Expired, result.Reason);
    }

    [Fact]
    public void Scheduled_cancellation_allows_access_before_period_cutoff()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CurrentPeriodEnd: Now.AddSeconds(1), CancelAtPeriodEnd: true),
            Now);

        Assert.True(result.IsAllowed);
    }

    [Fact]
    public void Scheduled_cancellation_expires_at_period_cutoff()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CurrentPeriodEnd: Now, CancelAtPeriodEnd: true),
            Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Expired, result.State);
        Assert.Equal(EntitlementReasonCodes.Expired, result.Reason);
    }

    [Fact]
    public void Cancelled_subscription_retains_access_only_before_period_cutoff()
    {
        var before = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Cancelled", CurrentPeriodEnd: Now.AddSeconds(1)),
            Now);
        var atCutoff = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Cancelled", CurrentPeriodEnd: Now),
            Now);

        Assert.True(before.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.CancellationPending, before.State);
        Assert.False(atCutoff.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Expired, atCutoff.State);
    }

    [Fact]
    public void American_canceled_spelling_uses_the_same_period_cutoff_semantics()
    {
        var before = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Canceled", CurrentPeriodEnd: Now.AddSeconds(1)), Now);
        var atCutoff = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Canceled", CurrentPeriodEnd: Now), Now);

        Assert.True(before.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.CancellationPending, before.State);
        Assert.False(atCutoff.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Expired, atCutoff.Reason);
    }

    [Fact]
    public void Cancelled_status_without_period_cutoff_fails_closed_as_unknown_policy()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts("Cancelled"), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Unknown, result.State);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, result.Reason);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void Scheduled_lifecycle_change_without_period_cutoff_fails_closed(
        bool cancelAtPeriodEnd,
        bool pauseAtPeriodEnd)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts(
                "Active",
                CancelAtPeriodEnd: cancelAtPeriodEnd,
                PauseAtPeriodEnd: pauseAtPeriodEnd),
            Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Unknown, result.State);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, result.Reason);
    }

    [Fact]
    public void Paused_status_is_denied()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts("Paused"), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Paused, result.State);
        Assert.Equal(EntitlementReasonCodes.Paused, result.Reason);
    }

    [Theory]
    [InlineData(-1, false, SubscriptionLifecycleState.Paused)]
    [InlineData(0, false, SubscriptionLifecycleState.Paused)]
    [InlineData(1, true, SubscriptionLifecycleState.Active)]
    public void PausedAt_takes_effect_at_its_instant(
        int offsetSeconds,
        bool expectedAllowed,
        SubscriptionLifecycleState expectedState)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", PausedAt: Now.AddSeconds(offsetSeconds)), Now);

        Assert.Equal(expectedAllowed, result.IsAllowed);
        Assert.Equal(expectedState, result.State);
        Assert.Equal(
            expectedAllowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.Paused,
            result.Reason);
    }

    [Theory]
    [InlineData(-1, false, SubscriptionLifecycleState.Expired)]
    [InlineData(0, false, SubscriptionLifecycleState.Expired)]
    [InlineData(1, true, SubscriptionLifecycleState.Active)]
    public void CancelledAt_takes_effect_at_its_instant(
        int offsetSeconds,
        bool expectedAllowed,
        SubscriptionLifecycleState expectedState)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CancelledAt: Now.AddSeconds(offsetSeconds)), Now);

        Assert.Equal(expectedAllowed, result.IsAllowed);
        Assert.Equal(expectedState, result.State);
        Assert.Equal(
            expectedAllowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.Expired,
            result.Reason);
    }

    [Fact]
    public void Scheduled_pause_applies_at_period_cutoff()
    {
        var before = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CurrentPeriodEnd: Now.AddSeconds(1), PauseAtPeriodEnd: true), Now);
        var atCutoff = SubscriptionLifecyclePolicy.Evaluate(
            new SubscriptionLifecycleFacts("Active", CurrentPeriodEnd: Now, PauseAtPeriodEnd: true), Now);

        Assert.True(before.IsAllowed);
        Assert.False(atCutoff.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Paused, atCutoff.Reason);
    }

    [Theory]
    [InlineData("PastDue")]
    [InlineData("Unpaid")]
    [InlineData("Expired")]
    public void Financially_inactive_or_expired_states_are_denied(string status)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts(status), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Expired, result.State);
        Assert.Equal(EntitlementReasonCodes.Expired, result.Reason);
    }

    [Fact]
    public void Inactive_status_is_denied_as_inactive()
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts("Inactive"), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Inactive, result.State);
        Assert.Equal(EntitlementReasonCodes.Inactive, result.Reason);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("FutureStatus")]
    public void Null_blank_and_unknown_statuses_fail_closed(string? status)
    {
        var result = SubscriptionLifecyclePolicy.Evaluate(new SubscriptionLifecycleFacts(status), Now);

        Assert.False(result.IsAllowed);
        Assert.Equal(SubscriptionLifecycleState.Unknown, result.State);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, result.Reason);
    }
}
