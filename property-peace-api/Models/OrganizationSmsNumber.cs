namespace brownstone_hub_api.Models
{
    public class OrganizationSmsNumber
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        public long? PurchasedByUserId { get; set; }
        public User? PurchasedByUser { get; set; }
        public string PhoneNumber { get; set; } = string.Empty;
        public string TwilioPhoneNumberSid { get; set; } = string.Empty;
        public string? FriendlyName { get; set; }
        public string? State { get; set; }
        public string? AreaCode { get; set; }
        public string Status { get; set; } = "Active";
        public bool IsActive { get; set; } = true;
        public bool IsPrimary { get; set; } = true;
        public DateTime PurchasedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReleasedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
