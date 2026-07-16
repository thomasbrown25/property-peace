namespace brownstone_hub_api.Config
{
    /// <summary>
    /// Configuration settings for RentSpree background check integration
    /// </summary>
    public class RentSpreeSettings
    {
        /// <summary>
        /// RentSpree API Key (required for API access)
        /// </summary>
        public string ApiKey { get; set; } = string.Empty;

        /// <summary>
        /// RentSpree API Secret (required for API access)
        /// </summary>
        public string ApiSecret { get; set; } = string.Empty;

        /// <summary>
        /// RentSpree API Base URL (default: https://api.rentspree.com/v1)
        /// </summary>
        public string BaseUrl { get; set; } = "https://api.rentspree.com/v1";

        /// <summary>
        /// Enable or disable background checks feature
        /// </summary>
        public bool EnableBackgroundChecks { get; set; } = true;

        /// <summary>
        /// Minimum credit score required to pass (default: 650)
        /// Range: 350-850 (TransUnion Resident Score)
        /// </summary>
        public int MinimumCreditScore { get; set; } = 650;

        /// <summary>
        /// Require criminal background check to pass (default: true)
        /// Note: Not available in WY, NJ, HI, DE, KY, SD, Cook County IL, MA
        /// </summary>
        public bool RequireCriminalCheck { get; set; } = true;

        /// <summary>
        /// Require eviction check to pass (default: true)
        /// Note: Not available for NY tenants
        /// </summary>
        public bool RequireEvictionCheck { get; set; } = true;

        /// <summary>
        /// Require income verification to pass (default: true)
        /// </summary>
        public bool RequireIncomeVerification { get; set; } = true;

        /// <summary>
        /// Minimum income to rent ratio required (default: 3.0)
        /// Example: 3.0 means income must be at least 3x monthly rent
        /// </summary>
        public decimal MinimumIncomeToRentRatio { get; set; } = 3.0m;

        /// <summary>
        /// Validates that required configuration is present
        /// </summary>
        /// <returns>True if configuration is valid, false otherwise</returns>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(ApiKey) 
                && !string.IsNullOrWhiteSpace(ApiSecret)
                && !string.IsNullOrWhiteSpace(BaseUrl)
                && MinimumCreditScore >= 350 
                && MinimumCreditScore <= 850
                && MinimumIncomeToRentRatio > 0;
        }

        /// <summary>
        /// Gets validation errors if configuration is invalid
        /// </summary>
        /// <returns>List of validation error messages</returns>
        public List<string> GetValidationErrors()
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(ApiKey))
                errors.Add("RentSpree ApiKey is required");

            if (string.IsNullOrWhiteSpace(ApiSecret))
                errors.Add("RentSpree ApiSecret is required");

            if (string.IsNullOrWhiteSpace(BaseUrl))
                errors.Add("RentSpree BaseUrl is required");

            if (MinimumCreditScore < 350 || MinimumCreditScore > 850)
                errors.Add($"RentSpree MinimumCreditScore must be between 350 and 850 (current: {MinimumCreditScore})");

            if (MinimumIncomeToRentRatio <= 0)
                errors.Add($"RentSpree MinimumIncomeToRentRatio must be greater than 0 (current: {MinimumIncomeToRentRatio})");

            return errors;
        }
    }
}

