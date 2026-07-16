namespace brownstone_hub_api.Dtos.Subscription
{
    public class StripeWebhookDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public DateTime Created { get; set; }
        public StripeWebhookDataDto Data { get; set; } = null!;
    }

    public class StripeWebhookDataDto
    {
        public StripeWebhookObjectDto Object { get; set; } = null!;
    }

    public class StripeWebhookObjectDto
    {
        public string Id { get; set; } = string.Empty;
        public string? Customer { get; set; }
        public string? Subscription { get; set; }
        public string? Status { get; set; }
        public long? CurrentPeriodStart { get; set; }
        public long? CurrentPeriodEnd { get; set; }
        public long? TrialStart { get; set; }
        public long? TrialEnd { get; set; }
        public bool? CancelAtPeriodEnd { get; set; }
        public long? CanceledAt { get; set; }
        public StripeWebhookItemsDto? Items { get; set; }
    }

    public class StripeWebhookItemsDto
    {
        public List<StripeWebhookItemDto> Data { get; set; } = [];
    }

    public class StripeWebhookItemDto
    {
        public StripeWebhookPriceDto? Price { get; set; }
    }

    public class StripeWebhookPriceDto
    {
        public string Id { get; set; } = string.Empty;
    }
}

