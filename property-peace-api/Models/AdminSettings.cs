namespace brownstone_hub_api.Models
{
    public class AdminSettings
    {
        public long Id { get; set; }
        public string NotificationEmail { get; set; } = string.Empty;
        /// <summary>When true, premium-only features (LeaseShield, RentEstimate, Reports, OnlineRentCollection) are accessible on all plans.</summary>
        public bool AllPremiumFeaturesOnFreePlan { get; set; } = false;
        public bool MaintenanceModeEnabled { get; set; } = false;
        public string MaintenanceTitle { get; set; } = "Property Peace is getting a quick tune-up";
        public string MaintenanceMessage { get; set; } = "We’re making updates to improve reliability and performance. Please check back shortly.";
        public string MaintenanceSupportEmail { get; set; } = "support@propertypeace.io";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

