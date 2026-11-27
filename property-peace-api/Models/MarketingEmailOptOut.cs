namespace brownstone_hub_api.Models;

public sealed class MarketingEmailOptOut
{
    public string EmailHash { get; set; } = string.Empty;

    public DateTimeOffset UnsubscribedAtUtc { get; set; }
}
