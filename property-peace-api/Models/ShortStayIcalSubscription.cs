using System.Text.Json.Serialization;

namespace brownstone_hub_api.Models;

// Import configuration and scheduler state; never expose the credential-bearing feed URL through JSON.
public sealed class ShortStayIcalSubscription
{
    public long Id { get; set; }
    public long UnitId { get; set; }
    [JsonIgnore] public Unit Unit { get; set; } = null!;
    public long OrgId { get; set; }
    [JsonIgnore] public Organization Organization { get; set; } = null!;
    [JsonIgnore] public string EncryptedUrl { get; set; } = string.Empty;
    [JsonIgnore] public string UrlFingerprint { get; set; } = string.Empty;
    public long Generation { get; set; } = 1;
    public bool Enabled { get; set; } = true;
    public DateTime? LastAttemptAtUtc { get; set; }
    public DateTime? LastSuccessAtUtc { get; set; }
    public string? FailureCode { get; set; }
    public int ConsecutiveFailures { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    // Durable worker claim: both fields are set on claim and cleared together on release.
    [JsonIgnore] public Guid? LeaseToken { get; set; }
    public DateTime? LeaseExpiresAtUtc { get; set; }
    [JsonIgnore] public ICollection<ShortStayIcalOccurrence> Occurrences { get; set; } = new List<ShortStayIcalOccurrence>();
}
