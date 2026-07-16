namespace brownstone_hub_api.Dtos.Subscription
{
    public class AdminUpdateSubscriptionDto
    {
        public long UserId { get; set; }
        public long NewPlanId { get; set; }
        public bool Prorate { get; set; } = true;
        public bool IsUpgrade { get; set; } = true;
    }
}
