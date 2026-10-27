namespace brownstone_hub_api.Dtos.ShortStay;

// Deliberately contains no URL, fingerprint, ciphertext, or untrusted failure detail.
public sealed record AirbnbCalendarStatusDto(
    long UnitId, bool Enabled, string Health, long? Generation, string TimeZoneId,
    DateTime? LastAttemptAtUtc, DateTime? LastSuccessAtUtc, DateTime? LastSuccessLocal,
    int ConsecutiveFailures, DateTime? NextAttemptAtUtc);

public sealed record ConnectAirbnbCalendarDto(string? Url);
