namespace brownstone_hub_api.Controllers;

/// <summary>Controls ownership duration and renewal cadence for Stripe webhook processing.</summary>
public sealed class StripeWebhookLeaseOptions
{
    public TimeSpan LeaseDuration { get; init; } = TimeSpan.FromMinutes(15);
    public TimeSpan HeartbeatInterval { get; init; } = TimeSpan.FromMinutes(5);
}
