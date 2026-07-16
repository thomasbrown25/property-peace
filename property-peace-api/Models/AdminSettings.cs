namespace brownstone_hub_api.Models
{
    public class AdminSettings
    {
        public long Id { get; set; }
        public string NotificationEmail { get; set; } = string.Empty;
        /// <summary>When true, premium-only features (LeaseShield, RentEstimate, Reports, OnlineRentCollection) are accessible on all plans.</summary>
        public bool AllPremiumFeaturesOnFreePlan { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

