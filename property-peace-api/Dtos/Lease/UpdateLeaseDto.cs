
namespace brownstone_hub_api.Dtos.Lease
{
    public class UpdateLeaseDto
    {
        public long Id { get; set; } = 0;
        public long PropertyId { get; set; } = 0;
        public long UnitId { get; set; } = 0;
        public string? Name { get; set; } // Lease name/nickname
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
        public bool? IsDrafted { get; set; } // Used only on initial lease creation to set IsDrafted on the LeaseAgreement
        public bool? IsScreeningComplete { get; set; }

        public long? OrganizationId { get; set; }
        public long? OperatingAccountId { get; set; } // Operating bank account (Stripe Connect) for this lease
        public bool MarkPastPaymentsAsPaid { get; set; } = false;
        
        // Automatic Rent Increase fields
        public string? RentIncreaseType { get; set; } // 'percentage' or 'amount' or null
        public decimal? RentIncreaseValue { get; set; } // Percentage (0-100) or dollar amount
        public int? RentIncreaseInterval { get; set; } // Number of months between increases

        // Auto-renew at end of term (fixed-term leases)
        public bool? AutoRenewLease { get; set; }
        public int? AutoRenewLeaseLength { get; set; } // Months for renewal term; -1 means month-to-month
        public bool? AutoRenewRentIncrement { get; set; }
        public string? AutoRenewRentIncrementType { get; set; } // "percentage" or "amount"
        public decimal? AutoRenewRentIncrementValue { get; set; }
        
        // Lease Fees
        public List<LeaseFeeDto>? Fees { get; set; }

        // Other deposits (pet deposit is on Lease.PetDepositAmount)
        public List<LeaseDepositDto>? LeaseDeposits { get; set; }

        // Rent/Deposit/Fees section (build-lease-agreement)
        public bool? ProratedRentDue { get; set; }
        public bool? IsProratedRent { get; set; }
        public decimal? PetDepositAmount { get; set; }
        public bool? RentCollectionByPlatform { get; set; }
        public bool? RentCollectionOther { get; set; }
        public string? RentCollectionOtherOptions { get; set; } // JSON
        public string? RentCollectionOtherSpecify { get; set; }

        // People on Lease (build-lease-agreement)
        public bool? AddTenantsLater { get; set; }
        public bool? TenantMailingAddressDiffers { get; set; }
        public string? TenantMailingStreetAddress { get; set; }
        public string? TenantMailingUnit { get; set; }
        public string? TenantMailingCity { get; set; }
        public string? TenantMailingState { get; set; }
        public string? TenantMailingZipCode { get; set; }
        public List<LeaseLandlordDto>? LeaseLandlords { get; set; }
        public List<LeaseCoSignerDto>? LeaseCoSigners { get; set; }
        public List<LeaseAdditionalSignerDto>? LeaseAdditionalSigners { get; set; }
        public List<LeaseOccupantDto>? LeaseOccupants { get; set; }

        // Pets, Smoking, & Other section
        public bool? PetsAllowed { get; set; }
        public string? SmokingAllowed { get; set; } // "yes", "no", "outsideOnly"
        public List<PetDto>? Pets { get; set; }
        public ParkingDto? Parking { get; set; }

        // Utilities, Maintenance, & Keys section
        public bool? HasSharedUtilities { get; set; }
        public string? SharedUtilitiesDisclosure { get; set; }
        public string? MaintenanceNotificationMethods { get; set; } // JSON array
        public List<UtilityServiceResponsibilityDto>? UtilityServiceResponsibilities { get; set; }
        public List<MaintenanceResponsibilityDto>? MaintenanceResponsibilities { get; set; }
        public List<LeaseKeyDto>? LeaseKeys { get; set; }

        // Provisions & Attachments section
        public bool? IncludeEarlyTerminationClause { get; set; }
        public string? EarlyTerminationClauseText { get; set; }
        public string? AdditionalTerms { get; set; }
        public bool? BuiltBefore1978 { get; set; }
        public bool? AwareOfLeadPaint { get; set; }
        public string? LeadPaintExplanation { get; set; }
        public bool? HasLeadPaintRecords { get; set; }
        public string? LeadPaintRecordsExplanation { get; set; }
    }
}