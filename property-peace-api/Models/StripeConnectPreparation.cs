namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Non-sensitive Property Peace preparation context collected before Stripe-hosted Connect onboarding.
    /// Legal identity, tax identifiers, identity documents, and bank details must never be stored here.
    /// </summary>
    public sealed class StripeConnectPreparation
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public long OrganizationId { get; set; }
        public string OperatingType { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string AuthorityRelationship { get; set; } = string.Empty;
        public bool AuthorityAttested { get; set; }
        public DateTimeOffset? AuthorityAttestedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public ICollection<StripeConnectPreparationProperty> Properties { get; set; } = [];
    }

    public sealed class StripeConnectPreparationProperty
    {
        public long Id { get; set; }
        public long StripeConnectPreparationId { get; set; }
        public StripeConnectPreparation Preparation { get; set; } = null!;
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
    }
}
