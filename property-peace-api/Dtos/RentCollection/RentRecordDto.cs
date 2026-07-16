using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.RentCollection
{
    public class RentRecordDto
    {
        public long Id { get; set; }
        public List<LoadTenantDto> Tenants { get; set; } = [];
        public string PropertyName { get; set; }
        public EPropertyType PropertyType { get; set; }
        public long PropertyId { get; set; }
        public string UnitName { get; set; }
        public decimal RentAmount { get; set; }
        public decimal OverdueAmount { get; set; }
        /// <summary>Overdue amount + current period rent when within 15-day charge window. Use for balance due display.</summary>
        public decimal AmountDueNow { get; set; }
        public decimal CollectedLifetime { get; set; } // Total payments collected for this lease
        public decimal Outstanding { get; set; } // Total outstanding for entire lease period (expected - collected)
        public long LeaseId { get; set; }
        public DateTime DueDate { get; set; }
        public ERentStatus Status { get; set; } // Paid, Unpaid, Overdue
        public string? PropertyImageUrl { get; set; } // First property image URL, if available
        public DateTime? UpdatedAt { get; set; } // Lease last updated (for sorting)
        public int PaymentIssueCount { get; set; }
        public int ProcessingPaymentCount { get; set; }
        public DateTime? OldestProcessingPaymentDate { get; set; }
        public bool HasLongProcessingPayment { get; set; }
        public string? PaymentIssueSummary { get; set; }
    }
}
