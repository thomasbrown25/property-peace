namespace brownstone_hub_api.Dtos.AICopilot
{
    public class OrganizationSummaryDto
    {
        public List<PropertySummaryDto> Properties { get; set; } = [];
        public List<TenantSummaryDto> Tenants { get; set; } = [];
        public RentStatusSummaryDto RentStatus { get; set; } = new();
        public List<MaintenanceRequestSummaryDto> MaintenanceRequests { get; set; } = [];
        public List<ApplicationSummaryDto> Applications { get; set; } = [];
        public List<LeaseExpirationSummaryDto> LeaseExpirations { get; set; } = [];
        public List<UpcomingLeaseSummaryDto> UpcomingLeases { get; set; } = [];
        public List<LeaseSummaryDto> Leases { get; set; } = []; // Active leases with signing status
        public List<ImportantTaskSummaryDto> ImportantTasks { get; set; } = [];
        public List<UrgentMessageSummaryDto> UrgentMessages { get; set; } = []; // Urgent messages from conversations
        public List<SuppressedActionDto> SuppressedActions { get; set; } = []; // Actions that are currently suppressed
        public List<VacantUnitDto> VacantUnits { get; set; } = []; // Units with no active lease
    }

    public class PropertySummaryDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int UnitCount { get; set; }
        public decimal OccupancyRate { get; set; }
    }

    public class TenantSummaryDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? UnitName { get; set; }
        public string LeaseStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public int? DaysOverdue { get; set; }
        public decimal? AmountOverdue { get; set; }
        public bool HasAccount { get; set; } = false; // Whether tenant has created a user account
        public DateTime? TenantSignedAt { get; set; } // When this tenant signed the lease (if applicable)
    }

    public class RentStatusSummaryDto
    {
        public decimal TotalExpected { get; set; }
        public decimal TotalCollected { get; set; }
        public List<OverdueRentDto> Overdue { get; set; } = [];
        public List<DueSoonRentDto> DueSoon { get; set; } = [];
    }

    public class OverdueRentDto
    {
        public long LeaseId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public List<string> TenantNames { get; set; } = []; // All tenants on the lease
        public decimal Amount { get; set; }       // Accumulated past-due from previous months only
        public decimal RentAmount { get; set; }   // Current month's rent due
        public int DaysOverdue { get; set; }
    }

    public class DueSoonRentDto
    {
        public long LeaseId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public List<string> TenantNames { get; set; } = []; // All tenants on the lease
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        public bool IsDueToday { get; set; } // True if due date is today
    }

    public class MaintenanceRequestSummaryDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? TenantName { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int DaysOpen { get; set; }
        public bool HasVendorAssigned { get; set; }
    }

    public class VacantUnitDto
    {
        public long UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public decimal ListedRentAmount { get; set; }
        public int DaysVacant { get; set; } // Days since last lease ended, or 0 if never leased
    }

    public class ApplicationSummaryDto
    {
        public long Id { get; set; }
        public string ApplicantName { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? UnitName { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? SubmittedAt { get; set; }
        public int DaysPending { get; set; }
    }

    public class LeaseExpirationSummaryDto
    {
        public long Id { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string PropertyName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public DateTime ExpirationDate { get; set; }
        public int DaysUntilExpiration { get; set; }
    }

    public class UpcomingLeaseSummaryDto
    {
        public long LeaseId { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public List<string> TenantNames { get; set; } = [];
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal RentAmount { get; set; }
        public int DaysUntilStart { get; set; }
        public bool HasApplication { get; set; } = false; // Whether an application has been sent/approved for this unit
        public bool ChecklistCompleted { get; set; } = false; // Whether move-in checklist is completed
    }

    public class ImportantTaskSummaryDto
    {
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public string Priority { get; set; } = string.Empty;
    }

    public class LeaseSummaryDto
    {
        public long LeaseId { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string UnitName { get; set; } = string.Empty;
        public List<TenantSigningInfoDto> Tenants { get; set; } = []; // Tenant signing information
        public string SignatureStatus { get; set; } = string.Empty; // NotSent, Sent, InProgress, PartiallySigned, Completed, Declined, Expired, Cancelled
        public DateTime? SignatureSentAt { get; set; } // When signature request was sent
        public DateTime? SignatureCompletedAt { get; set; } // When all parties completed signing
        public DateTime? SignatureExpiresAt { get; set; } // When signature request expires
        public string? LandlordSignedBy { get; set; } // Name of landlord who signed
        public DateTime? LandlordSignedAt { get; set; } // When landlord signed
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal RentAmount { get; set; }
        public bool IsActive { get; set; }
        public List<string> TasksNeeded { get; set; } = []; // List of tasks that need to be done for this lease
    }

    public class TenantSigningInfoDto
    {
        public long TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public bool HasAccount { get; set; } = false; // Whether tenant has created a user account
        public bool HasSigned { get; set; } = false; // Whether tenant has signed the lease
        public DateTime? SignedAt { get; set; } // When tenant signed (if applicable)
    }

    public class UrgentMessageSummaryDto
    {
        public long ConversationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? TenantName { get; set; }
        public string? PropertyName { get; set; }
        public string? UnitName { get; set; }
        public string? AiSummary { get; set; }
        public List<UrgentItemSummaryDto> UrgentItems { get; set; } = [];
        public DateTime? UrgentItemsDetectedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }

    public class UrgentItemSummaryDto
    {
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string? MessageExcerpt { get; set; }
    }
}

