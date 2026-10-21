using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.ShortStay;

// The unit and timezone are resolved from the authorized route unit, never supplied by the client.
public sealed class SaveShortStayListingDto
{
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    [CentPrecision]
    public decimal NightlyBasePrice { get; set; }
    [Range(1, int.MaxValue)]
    public int MinimumNights { get; set; } = 1;
    [Range(1, int.MaxValue)]
    public int Capacity { get; set; } = 1;
    [Range(typeof(decimal), "0", "9999999999999999.99")]
    [CentPrecision]
    public decimal CleaningFee { get; set; }
    [Range(typeof(decimal), "0", "100")]
    public decimal? LodgingTaxRatePercent { get; set; }
    // Explicit owner/manager acknowledgement of responsibility for calculating and remitting
    // applicable lodging taxes. Neither identity nor timestamp is accepted from this request.
    public bool AttestLodgingTaxResponsibility { get; set; }
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
}

internal sealed class CentPrecisionAttribute : ValidationAttribute
{
    internal static bool IsValidPrice(decimal price) => decimal.Round(price, 2) == price;

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext) =>
        value is decimal price && IsValidPrice(price)
            ? ValidationResult.Success
            : new ValidationResult($"{validationContext.DisplayName} must have no more than two decimal places",
                [validationContext.MemberName!]);
}
