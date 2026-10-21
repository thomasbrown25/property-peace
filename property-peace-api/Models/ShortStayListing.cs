using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// Nightly inventory is intentionally separate from the monthly lease Listing aggregate.
public class ShortStayListing
{
    public long Id { get; set; }
    public long UnitId { get; set; }
    public Unit Unit { get; set; } = null!;
    public ICollection<ShortStayListingPhoto> Photos { get; set; } = new List<ShortStayListingPhoto>();

    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal NightlyBasePrice { get; set; }
    [Range(1, int.MaxValue)]
    public int MinimumNights { get; set; } = 1;
    [Range(1, int.MaxValue)]
    public int Capacity { get; set; } = 1;
    [Range(typeof(decimal), "0", "9999999999999999.99")]
    public decimal CleaningFee { get; set; }
    // Null means the owner has not configured tax; zero is a deliberate attested rate.
    [Range(typeof(decimal), "0", "100")]
    public decimal? LodgingTaxRatePercent { get; set; }
    public DateTime? TaxPolicyAttestedAtUtc { get; set; }
    public long? TaxPolicyAttestedByUserId { get; set; }
    public TimeOnly? CheckInTime { get; set; }
    public TimeOnly? CheckOutTime { get; set; }
    [MaxLength(4000)]
    public string? HouseRules { get; set; }
    [MaxLength(4000)]
    public string? Amenities { get; set; }
    [MaxLength(2000)]
    public string? CancellationPolicy { get; set; }
    [MaxLength(100)]
    public string? PublicTitle { get; set; }
    [MaxLength(1200)]
    public string? PublicSummary { get; set; }
    public ShortStayListingStatus Status { get; set; } = ShortStayListingStatus.Draft;
}

public enum ShortStayListingStatus { Draft, Published }
