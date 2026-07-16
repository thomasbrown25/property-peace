using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class Lease
    {
        public long Id { get; set; }
        public long UnitId { get; set; }
        public string? Name { get; set; } // Lease name/nickname
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? RentAmount { get; set; }
        public decimal? DepositAmount { get; set; }
        public int? LeaseLength { get; set; }
        public string? RentFrequency { get; set; }
        public int? RentDueDay { get; set; }
        public decimal? OverdueAmount { get; set; }
        public bool? CustomDateSelected { get; set; }
        
        // Automatic Rent Increase fields
        public string? RentIncreaseType { get; set; } // 'percentage' or 'amount' or null
        public decimal? RentIncreaseValue { get; set; } // Percentage (0-100) or dollar amount
        public int? RentIncreaseInterval { get; set; } // Number of months between increases

        // Auto-renew at end of term (fixed-term leases)
        public bool AutoRenewLease { get; set; } = false;
        public int? AutoRenewLeaseLength { get; set; } // Months for renewal term; -1 means month-to-month
        public bool? AutoRenewRentIncrement { get; set; }
        public string? AutoRenewRentIncrementType { get; set; } // "percentage" or "amount"
        public decimal? AutoRenewRentIncrementValue { get; set; }

        public bool IsActive { get; set; } = true;
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        public bool? IsScreeningComplete { get; set; } // Track if tenant screening step is completed

        /// <summary>Smoking policy: "yes", "no", "outsideOnly"</summary>
        [MaxLength(20)]
        public string? SmokingAllowed { get; set; }

        /// <summary>Whether pets are allowed on this lease.</summary>
        public bool? PetsAllowed { get; set; }

        // Lease document template reference
        public long? LeaseTemplateId { get; set; } // Reference to DocumentTemplate used

        // Rent/Deposit/Fees section (build-lease-agreement)
        public bool? ProratedRentDue { get; set; } // Prorated rent at move-in (yes/no) - legacy
        public bool? IsProratedRent { get; set; } // Prorated rent at move-in (yes/no)
        public decimal? PetDepositAmount { get; set; }
        public bool? RentCollectionByPlatform { get; set; } // Rent payments by platform
        public bool? RentCollectionOther { get; set; } // Other methods outside platform
        public string? RentCollectionOtherOptions { get; set; } // JSON: { "cash", "personalCheck", ... }
        public string? RentCollectionOtherSpecify { get; set; }

        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        // Operating Bank Account (Stripe Connect account for this lease - where rent is received)
        public long? OperatingAccountId { get; set; }
        public BankAccount? OperatingAccount { get; set; }

        // People on Lease (build-lease-agreement)
        /// <summary>User chose "I'll add my tenants later"</summary>
        public bool AddTenantsLater { get; set; } = false;
        /// <summary>Tenant(s) have a mailing address different from rental property (e.g. PO box)</summary>
        public bool TenantMailingAddressDiffers { get; set; } = false;
        public string? TenantMailingStreetAddress { get; set; }
        public string? TenantMailingUnit { get; set; }
        public string? TenantMailingCity { get; set; }
        public string? TenantMailingState { get; set; }
        public string? TenantMailingZipCode { get; set; }

        public LeaseAgreement? LeaseAgreement { get; set; }

        public Unit Unit { get; set; }
        public ICollection<TenantLease> TenantLeases { get; set; } = [];
        public ICollection<LeaseLandlord> LeaseLandlords { get; set; } = [];
        public ICollection<LeaseCoSigner> LeaseCoSigners { get; set; } = [];
        public ICollection<LeaseAdditionalSigner> LeaseAdditionalSigners { get; set; } = [];
        public ICollection<LeaseOccupant> LeaseOccupants { get; set; } = [];
        public ICollection<Deposit> Deposits { get; set; } = [];
        public ICollection<LeaseFee> LeaseFees { get; set; } = [];
        public ICollection<LeaseDeposit> LeaseDeposits { get; set; } = [];
        public ICollection<Pet> Pets { get; set; } = [];
        public Parking? Parking { get; set; }

        // Utilities, Maintenance, & Keys (build-lease-agreement)
        public bool? HasSharedUtilities { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
        public string? SharedUtilitiesDisclosure { get; set; }
        [MaxLength(500)]
        public string? MaintenanceNotificationMethods { get; set; } // JSON array e.g. ["platform","usMail","email","text","other"]
        public ICollection<UtilityServiceResponsibility> UtilityServiceResponsibilities { get; set; } = [];
        public ICollection<MaintenanceResponsibility> MaintenanceResponsibilities { get; set; } = [];
        public ICollection<LeaseKey> LeaseKeys { get; set; } = [];

        // Provisions & Attachments (build-lease-agreement)
        public bool? IncludeEarlyTerminationClause { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
        public string? EarlyTerminationClauseText { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
        public string? AdditionalTerms { get; set; }
        public bool? BuiltBefore1978 { get; set; }
        public bool? AwareOfLeadPaint { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
        public string? LeadPaintExplanation { get; set; }
        public bool? HasLeadPaintRecords { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.Column(TypeName = "nvarchar(max)")]
        public string? LeadPaintRecordsExplanation { get; set; }

        public DateTime? UpdatedAt { get; set; }

        /// <summary>When the landlord completed "Create a Move-in Condition Report" for this lease (customized from this lease).</summary>
        public DateTime? MoveInReportTemplateCompletedAt { get; set; }
    }
}