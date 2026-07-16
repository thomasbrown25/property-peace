namespace brownstone_hub_api.Dtos.Subscription
{
    public class AdminAssignSubscriptionDto
    {
        public long UserId { get; set; }
        public long PlanId { get; set; }
        public string? BillingCycle { get; set; }
    }
}
