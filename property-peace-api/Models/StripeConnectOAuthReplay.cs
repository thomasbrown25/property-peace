namespace brownstone_hub_api.Models;

/// <summary>
/// A non-reversible record that an OAuth authorization response was consumed.
/// OAuth codes and state values are never persisted in their original form.
/// </summary>
public sealed class StripeConnectOAuthReplay
{
    public string CodeHash { get; set; } = string.Empty;
    public string StateNonceHash { get; set; } = string.Empty;
    public DateTime ConsumedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
