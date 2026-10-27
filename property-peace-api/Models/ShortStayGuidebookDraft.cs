using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// Owner workspace only. Never expose this aggregate through guest or public queries.
public sealed class ShortStayGuidebookDraft
{
    public long UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    [MaxLength(2000)] public string? HouseRules { get; set; }
    [MaxLength(2000)] public string? ArrivalOverview { get; set; }
    [MaxLength(2000)] public string? LocalNotes { get; set; }
}
