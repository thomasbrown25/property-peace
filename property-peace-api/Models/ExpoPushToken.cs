namespace brownstone_hub_api.Models;

// A token belongs to one user at a time; reassignment on login prevents cross-account delivery.
public sealed class ExpoPushToken
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; }
}
