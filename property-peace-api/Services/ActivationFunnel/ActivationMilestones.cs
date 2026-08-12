namespace brownstone_hub_api.Services.ActivationFunnel;

public static class ActivationMilestones
{
    public const string PropertyAdded = "property_added";
    public const string ListingPublished = "listing_published";
    public const string LeadReceived = "lead_received";
    public const string ShowingBooked = "showing_booked";
    public const string ApplicationCompleted = "application_completed";
    public const string ScreeningCompleted = "screening_completed";
    public const string LeaseSigned = "lease_signed";
    public const string TenantInvited = "tenant_invited";
    public const string FirstRentRecordedOrPaid = "first_rent_recorded_or_paid";
    public const string MaintenanceClosed = "maintenance_closed";

    public static IReadOnlyList<string> All { get; } = Array.AsReadOnly(new[]
    {
        PropertyAdded, ListingPublished, LeadReceived, ShowingBooked, ApplicationCompleted,
        ScreeningCompleted, LeaseSigned, TenantInvited, FirstRentRecordedOrPaid, MaintenanceClosed
    });

    public static bool IsKnown(string value) => All.Contains(value, StringComparer.Ordinal);
}
