using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.Unit;

namespace brownstone_hub_api.Dtos.Lease
{
    public class LoadLeaseDto
    {
        public long Id { get; set; }
        public string? Name { get; set; } // Lease name/nickname
        public ICollection<LoadTenantDto> Tenants { get; set; } = [];
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? RentAmount { get; set; }
        public decimal? DepositAmount { get; set; }
        public int? LeaseLength { get; set; }
        public bool? CustomDateSelected { get; set; }
        public string? RentFrequency { get; set; }
        public int? RentDueDay { get; set; }
        public decimal? OverdueAmount { get; set; }
        public bool IsActive { get; set; } = true;
        public bool? IsScreeningComplete { get; set; }

        // Nested lease agreement (signature workflow + builder steps)
        public LoadLeaseAgreementDto? LeaseAgreement { get; set; }

        // Automatic Rent Increase fields
        public string? RentIncreaseType { get; set; } // 'percentage' or 'amount' or null
        public decimal? RentIncreaseValue { get; set; } // Percentage (0-100) or dollar amount
        public int? RentIncreaseInterval { get; set; } // Number of months between increases

        // Auto-renew at end of term (fixed-term leases)
        public bool AutoRenewLease { get; set; }
        public int? AutoRenewLeaseLength { get; set; } // Months for renewal term; -1 means month-to-month
        public bool? AutoRenewRentIncrement { get; set; }
        public string? AutoRenewRentIncrementType { get; set; } // "percentage" or "amount"
        public decimal? AutoRenewRentIncrementValue { get; set; }
        public bool CreateChecklistOnStartDate { get; set; }

        public long? LeaseTemplateId { get; set; }

        // Organization (so clients can preserve it on update)
        public long? OrganizationId { get; set; }

        // Flattened property & unit info (safe to serialize)
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public string PropertyType { get; set; } = string.Empty;
        public long? OperatingAccountId { get; set; } // Operating bank account ID for this lease (where rent is received)

        public long UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;

        // Landlord Information
        public long LandlordId { get; set; }
        public string LandlordName { get; set; } = string.Empty;
        public string LandlordEmail { get; set; } = string.Empty;
        public string? LandlordPhone { get; set; }
        public string? LandlordSmsNumber { get; set; }

        // Convenience
        public DateTime? NextDueDate { get; set; }
        
        // Property Image
        public string? PropertyImageUrl { get; set; } // First property image URL, if available
        
        // Lease Fees
        public ICollection<LeaseFeeDto> Fees { get; set; } = [];

        // Other deposits (pet deposit is PetDepositAmount on lease)
        public ICollection<LeaseDepositDto> LeaseDeposits { get; set; } = [];

        // Rent/Deposit/Fees section (build-lease-agreement)
        public bool? ProratedRentDue { get; set; }
        public bool? IsProratedRent { get; set; }
        public decimal? ProratedRentAmount { get; set; }
        public string? ProrationMethod { get; set; }
        public decimal? PetDepositAmount { get; set; }
        public bool? RentCollectionByPlatform { get; set; }
        public bool? RentCollectionOther { get; set; }
        public string? RentCollectionOtherOptions { get; set; } // JSON
        public string? RentCollectionOtherSpecify { get; set; }

        // People on Lease (build-lease-agreement)
        public bool AddTenantsLater { get; set; }
        public bool TenantMailingAddressDiffers { get; set; }
        public string? TenantMailingStreetAddress { get; set; }
        public string? TenantMailingUnit { get; set; }
        public string? TenantMailingCity { get; set; }
        public string? TenantMailingState { get; set; }
        public string? TenantMailingZipCode { get; set; }
        public ICollection<LeaseLandlordDto> LeaseLandlords { get; set; } = [];
        public ICollection<LeaseCoSignerDto> LeaseCoSigners { get; set; } = [];
        public ICollection<LeaseAdditionalSignerDto> LeaseAdditionalSigners { get; set; } = [];
        public ICollection<LeaseOccupantDto> LeaseOccupants { get; set; } = [];

        // Pets, Smoking, & Other section
        public bool? PetsAllowed { get; set; }
        public string? SmokingAllowed { get; set; } // "yes", "no", "outsideOnly"
        public ICollection<PetDto> Pets { get; set; } = [];
        public ParkingDto? Parking { get; set; }

        // Utilities, Maintenance, & Keys section
        public bool? HasSharedUtilities { get; set; }
        public string? SharedUtilitiesDisclosure { get; set; }
        public string? MaintenanceNotificationMethods { get; set; } // JSON array
        public ICollection<UtilityServiceResponsibilityDto> UtilityServiceResponsibilities { get; set; } = [];
        public ICollection<MaintenanceResponsibilityDto> MaintenanceResponsibilities { get; set; } = [];
        public ICollection<LeaseKeyDto> LeaseKeys { get; set; } = [];

        // Provisions & Attachments section
        public bool? IncludeEarlyTerminationClause { get; set; }
        public string? EarlyTerminationClauseText { get; set; }
        public string? AdditionalTerms { get; set; }
        public bool? BuiltBefore1978 { get; set; }
        public bool? AwareOfLeadPaint { get; set; }
        public string? LeadPaintExplanation { get; set; }
        public bool? HasLeadPaintRecords { get; set; }
        public string? LeadPaintRecordsExplanation { get; set; }

        public DateTime? UpdatedAt { get; set; }

        /// <summary>When the move-in report template step was completed for this lease (so "Create a Move-in Condition Report" shows done only for this lease).</summary>
        public DateTime? MoveInReportTemplateCompletedAt { get; set; }
    }
}
