namespace brownstone_hub_api.Dtos.ShortStay;

// All dates are property-local calendar dates. EndDate is exclusive.
public sealed record SaveShortStayBlockDto(DateOnly StartDate, DateOnly EndDate, string? Reason);
public sealed record SaveShortStayRateDto(decimal NightlyRate);
public sealed record SaveShortStayRateRangeDto(DateOnly StartDate, DateOnly EndDate, decimal NightlyRate);
// Owner blocks have positive ids; imported Airbnb occurrences use negative ids and cannot be deleted via blocks/{id}.
public sealed record ShortStayBlockDto(long Id, DateOnly StartDate, DateOnly EndDate, string? Reason, string Source);
public sealed record ShortStayNightDto(DateOnly Date, decimal? BaseRate, decimal? OverrideRate, decimal? EffectiveRate,
    string? PriceSource = null);
public sealed record ShortStayCalendarDto(long UnitId, string TimeZoneId, DateOnly StartDate, DateOnly EndDate,
    IReadOnlyList<ShortStayBlockDto> Blocks, IReadOnlyList<ShortStayNightDto> Nights);
public sealed record ShortStayRateDto(DateOnly Date, decimal NightlyRate);
