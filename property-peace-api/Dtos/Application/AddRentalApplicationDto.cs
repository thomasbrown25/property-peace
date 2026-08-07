using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Application
{
    public class AddRentalApplicationDto
    {
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        
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
        
        // Status (defaults to Draft, but can be set to Submitted)
        public EApplicationStatus Status { get; set; } = EApplicationStatus.Draft;
        
        // Application Source
        public bool IsLandlordEntered { get; set; } = false; // True if landlord manually entered the application
    }
}

