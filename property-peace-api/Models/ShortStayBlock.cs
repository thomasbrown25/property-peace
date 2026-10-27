using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// Owner-managed unavailable nights: [StartDate, EndDate), in the property's local calendar.
// Overlap with other blocks for the same unit is validated by the calendar service.
public class ShortStayBlock
{
    public long Id { get; set; }
    public long UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    [MaxLength(500)]
    public string? Reason { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
