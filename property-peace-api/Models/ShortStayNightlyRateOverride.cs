using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// One price override for one local night of a short-term unit.
public class ShortStayNightlyRateOverride
{
    public long Id { get; set; }
    public long UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    public DateOnly Date { get; set; }
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal NightlyRate { get; set; }
}
