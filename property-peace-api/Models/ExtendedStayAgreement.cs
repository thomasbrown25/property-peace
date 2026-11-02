namespace brownstone_hub_api.Models;

// Owner-created occupancy agreement draft; not a signed lease, reservation or payment.
public sealed class ExtendedStayAgreement
{
    public long Id { get; set; }
    public long UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    public long OrganizationId { get; set; }
    public long CreatedByUserId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string OccupantName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
