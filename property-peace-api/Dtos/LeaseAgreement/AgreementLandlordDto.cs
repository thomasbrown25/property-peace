using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.LeaseAgreement;

// No client-controlled child identity or ownership in supplemental agreement writes.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class AgreementLandlordDto : IValidatableObject
{
    [Required]
    [RegularExpression("^(Individual|Company)$")]
    public string EntityType { get; set; } = "Individual";
    [StringLength(200)] public string? FirstName { get; set; }
    [StringLength(200)] public string? LastName { get; set; }
    [StringLength(300)] public string? CompanyName { get; set; }
    [EmailAddress, StringLength(256)] public string? Email { get; set; }
    [StringLength(50)] public string? Phone { get; set; }
    [StringLength(500)] public string? StreetAddress { get; set; }
    [StringLength(50)] public string? Unit { get; set; }
    [StringLength(200)] public string? City { get; set; }
    [StringLength(50)] public string? State { get; set; }
    [StringLength(20)] public string? ZipCode { get; set; }
    public int SortOrder { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EntityType == "Individual")
        {
            if (string.IsNullOrWhiteSpace(FirstName))
                yield return new ValidationResult("First name is required for an individual landlord.", [nameof(FirstName)]);
            if (string.IsNullOrWhiteSpace(LastName))
                yield return new ValidationResult("Last name is required for an individual landlord.", [nameof(LastName)]);
        }
        if (EntityType == "Company" && string.IsNullOrWhiteSpace(CompanyName))
            yield return new ValidationResult("Company name is required for a company landlord.", [nameof(CompanyName)]);
    }
}
