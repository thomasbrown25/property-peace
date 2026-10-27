using System.Text.Json.Serialization;

namespace brownstone_hub_api.Models;

// Only occupied local calendar dates and keyed event identity are retained; no ICS payload or guest data.
public sealed class ShortStayIcalOccurrence
{
    public long Id { get; set; }
    public long SubscriptionId { get; set; }
    [JsonIgnore] public ShortStayIcalSubscription Subscription { get; set; } = null!;
    // HMAC identity keys, not the raw UID / RECURRENCE-ID strings from an untrusted feed.
    [JsonIgnore] public string UidKey { get; set; } = string.Empty;
    [JsonIgnore] public string RecurrenceKey { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; } // exclusive
}
