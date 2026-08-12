using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a rental application submitted by a prospective tenant
    /// </summary>
    public class RentalApplication
    {
        public long Id { get; set; }
        
        // Application Status
        public EApplicationStatus Status { get; set; } = EApplicationStatus.Draft;
        
        // Property/Unit Information
        public long PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        public long? UnitId { get; set; } // Optional - may apply to property or specific unit
        public Unit? Unit { get; set; }
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Applicant Information
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public DateTime? DateOfBirth { get; set; }

        public string? CurrentAddress { get; set; }
        public string? CurrentCity { get; set; }
        public string? CurrentState { get; set; }
        public string? CurrentZipCode { get; set; }
        
        // Employment Information
        public string? EmployerName { get; set; }
        public string? JobTitle { get; set; }
        public decimal? MonthlyIncome { get; set; }
        public int? EmploymentMonths { get; set; } // How long at current job
        
        // References
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelationship { get; set; }
        public string? PreviousLandlordName { get; set; }
        public string? PreviousLandlordPhone { get; set; }
        
        // Application Details
        public int? NumberOfOccupants { get; set; }
        public bool HasPets { get; set; } = false;
        public string? PetDetails { get; set; } // Type, breed, size, etc.
        public bool HasVehicles { get; set; } = false;
        public string? VehicleDetails { get; set; } // Make, model, license plate
        public DateTime? DesiredMoveInDate { get; set; }
        public string? AdditionalNotes { get; set; }
        
        // Review Information
        public string? RejectionReason { get; set; } // If rejected
        public string? ReviewNotes { get; set; } // Internal notes from landlord
        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public long? ReviewedBy { get; set; } // UserId of reviewer
        
        // If approved and converted to tenant
        public long? ConvertedToTenantId { get; set; } // Link to Tenant if approved
        public Tenant? ConvertedToTenant { get; set; }
        public long? ConvertedToLeaseId { get; set; } // Link to Lease if approved
        public Lease? ConvertedToLease { get; set; }
        
        // Relationships
        public long LandlordId { get; set; }
        public User Landlord { get; set; } = null!;
        
        // PDF Document Storage (generated when application is submitted)
        public string? PdfBlobName { get; set; } // Blob name for generated PDF
        public string? PdfBlobUrl { get; set; } // URL to generated PDF
        

        // Application Source
        public bool IsLandlordEntered { get; set; } = false; // True if application was manually entered by landlord, false if tenant submitted
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
        public long? CreatedBy { get; set; }
        public long? UpdatedBy { get; set; }
    }
}

