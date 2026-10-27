using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.ShortStay;

// Persistence-facing draft contract only; no guest/booking endpoint is exposed.
public sealed class ShortStayListingDraftDto
{
    [Range(1, long.MaxValue)]
    public long UnitId { get; set; }
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal NightlyBasePrice { get; set; }
    public decimal? WeekendNightlyRate { get; set; }
    public decimal WeeklyDiscountPercent { get; set; }
    public decimal MonthlyDiscountPercent { get; set; }
    [Range(1, int.MaxValue)]
    public int MinimumNights { get; set; } = 1;
    [Range(1, int.MaxValue)]
    public int Capacity { get; set; } = 1;
    [Range(typeof(decimal), "0", "9999999999999999.99")]
    public decimal CleaningFee { get; set; }
    public decimal? LodgingTaxRatePercent { get; set; }
    public DateTime? TaxPolicyAttestedAtUtc { get; set; }
    public long? TaxPolicyAttestedByUserId { get; set; }
    [Required, IanaTimeZone]
    public string? TimeZoneId { get; set; }
    public TimeOnly? CheckInTime { get; set; }
    public TimeOnly? CheckOutTime { get; set; }
    [MaxLength(4000)]
    public string? HouseRules { get; set; }
    [MaxLength(4000)]
    public string? Amenities { get; set; }
    [MaxLength(2000)]
    public string? CancellationPolicy { get; set; }
    public string? PublicTitle { get; set; }
    public string? PublicSummary { get; set; }
}
