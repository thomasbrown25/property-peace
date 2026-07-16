namespace brownstone_hub_api.Dtos.Subscription
{
    public class SubscriptionStatusDto
    {
        public bool HasActiveSubscription { get; set; }
        public SubscriptionDto? Subscription { get; set; }
        public int CurrentPropertyCount { get; set; }
        public int CurrentTotalUnits { get; set; }
        public int? MaxProperties { get; set; }
        public int? MaxTotalUnits { get; set; }
        public int? RemainingPropertySlots { get; set; }
        public int? RemainingUnitSlots { get; set; }
        public bool CanAddProperty { get; set; }
        public bool IsTrialActive { get; set; }
        public int? TrialDaysRemaining { get; set; }
        public bool RequiresUpgrade { get; set; }
        public string? UpgradeMessage { get; set; }
    }
}

