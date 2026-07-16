namespace brownstone_hub_api.Models
{
    public class RentEstimateCache
    {
        public long Id { get; set; }

        // SHA-256 hash of the normalized address + unit details (for fast lookup)
        public string CacheKey { get; set; } = string.Empty;

        // Address fields (stored for debugging / display)
        public string Address { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string ZipCode { get; set; } = string.Empty;

        // Unit details used in the request
        public string? Bedrooms { get; set; }
        public string? Bathrooms { get; set; }
        public int? SquareFeet { get; set; }
        public string? PropertyType { get; set; }

        // Rentcast response
        public decimal? RentEstimate { get; set; }
        public decimal? RentRangeLow { get; set; }
        public decimal? RentRangeHigh { get; set; }

        // Raw comparables JSON (stored as string to avoid schema churn)
        public string? ComparablesJson { get; set; }

        // Cache metadata
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public bool IsError { get; set; } = false;
        public string? ErrorMessage { get; set; }
    }
}
