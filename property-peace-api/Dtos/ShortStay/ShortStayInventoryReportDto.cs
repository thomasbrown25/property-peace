namespace brownstone_hub_api.Dtos.ShortStay;

// Inventory and pricing coverage only. Claims are unavailable nights, not booking, occupancy, or revenue metrics.
public sealed record ShortStayInventoryReportDto(
    long UnitId, string TimeZoneId, DateOnly Start, DateOnly End, DateTime SnapshotAtUtc,
    int TotalNights, int OwnerBlockedNights, int AirbnbBlockedNights, int OverlapNights,
    int BlockedNights, int UnblockedNights, int PricedUnblockedNights, int UnpricedUnblockedNights,
    string AirbnbSyncStatus, bool AirbnbSyncStaleWarning,
    bool BookingMetricsAvailable = false, bool RevenueMetricsAvailable = false, bool OccupancyMetricsAvailable = false,
    int HeldNights = 0, int ConfirmedNights = 0);
