using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Application
{
    public class LoadRentalApplicationDto
    {
        public long Id { get; set; }
        public EApplicationStatus Status { get; set; }
        public string StatusName { get; set; } = string.Empty;
        
        // Property/Unit Information
        public long PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
        
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
        public int? EmploymentMonths { get; set; }
        
        // References
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelationship { get; set; }
        public string? PreviousLandlordName { get; set; }
        public string? PreviousLandlordPhone { get; set; }
        
        // Application Details
        public int? NumberOfOccupants { get; set; }
        public bool HasPets { get; set; } = false;
        public string? PetDetails { get; set; }
        public bool HasVehicles { get; set; } = false;
        public string? VehicleDetails { get; set; }
        public DateTime? DesiredMoveInDate { get; set; }
        public string? AdditionalNotes { get; set; }
        
        // Review Information
        public string? RejectionReason { get; set; }
        public string? ReviewNotes { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public long? ReviewedBy { get; set; }
        
        // Conversion
        public long? ConvertedToTenantId { get; set; }
        public long? ConvertedToLeaseId { get; set; }
        
        // Relationships
        public long LandlordId { get; set; }
        public long? OrganizationId { get; set; }
        
        // PDF Document Storage
        public string? PdfBlobName { get; set; }
        public string? PdfBlobUrl { get; set; }
        

        // Application Source
        public bool IsLandlordEntered { get; set; } // True if application was manually entered by landlord
        
        // Audit fields
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

