using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.BackgroundCheck
{
    /// <summary>
    /// Request DTO for initiating a RentSpree background check
    /// </summary>
    public class RentSpreeRequestDto
    {
        [JsonPropertyName("first_name")]
        public string FirstName { get; set; } = string.Empty;

        [JsonPropertyName("last_name")]
        public string LastName { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("date_of_birth")]
        public string? DateOfBirth { get; set; } // Format: YYYY-MM-DD

        [JsonPropertyName("current_address")]
        public RentSpreeAddressDto? CurrentAddress { get; set; }

        [JsonPropertyName("employment")]
        public RentSpreeEmploymentDto? Employment { get; set; }

        [JsonPropertyName("property_address")]
        public RentSpreeAddressDto? PropertyAddress { get; set; }

        [JsonPropertyName("monthly_rent")]
        public decimal? MonthlyRent { get; set; }

        [JsonPropertyName("screening_package")]
        public string ScreeningPackage { get; set; } = "full"; // "basic", "full", "premium"
    }

    public class RentSpreeAddressDto
    {
        [JsonPropertyName("street")]
        public string Street { get; set; } = string.Empty;

        [JsonPropertyName("city")]
        public string City { get; set; } = string.Empty;

        [JsonPropertyName("state")]
        public string State { get; set; } = string.Empty;

        [JsonPropertyName("zip")]
        public string Zip { get; set; } = string.Empty;
    }

    public class RentSpreeEmploymentDto
    {
        [JsonPropertyName("employer_name")]
        public string? EmployerName { get; set; }

        [JsonPropertyName("job_title")]
        public string? JobTitle { get; set; }

        [JsonPropertyName("monthly_income")]
        public decimal? MonthlyIncome { get; set; }

        [JsonPropertyName("employment_months")]
        public int? EmploymentMonths { get; set; }
    }
}

