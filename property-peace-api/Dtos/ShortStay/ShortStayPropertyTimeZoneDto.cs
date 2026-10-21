namespace brownstone_hub_api.Dtos.ShortStay;

public sealed record ShortStayPropertyTimeZoneDto(long PropertyId, string? TimeZoneId);

public sealed record SaveShortStayPropertyTimeZoneDto(string? TimeZoneId);
