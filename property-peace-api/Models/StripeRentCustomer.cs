using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// A subscription customer on the platform must never be reused for connected-account rent.
public sealed class StripeRentCustomer
{
    public long TenantUserId { get; set; }
    [MaxLength(255)] public string StripeAccountId { get; set; } = string.Empty;
    [MaxLength(255)] public string CustomerId { get; set; } = string.Empty;
}
