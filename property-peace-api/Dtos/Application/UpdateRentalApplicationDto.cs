using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Application
{
    public class UpdateRentalApplicationDto
    {
        public long Id { get; set; }
        public EApplicationStatus? Status { get; set; }
        public string? RejectionReason { get; set; }
        public string? ReviewNotes { get; set; }
        public long? ConvertedToTenantId { get; set; }
        public long? ConvertedToLeaseId { get; set; }
        
        // Allow updating any field
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Ssn { get; set; }
        public string? CurrentAddress { get; set; }
        public string? CurrentCity { get; set; }
        public string? CurrentState { get; set; }
        public string? CurrentZipCode { get; set; }
        public string? EmployerName { get; set; }
        public string? JobTitle { get; set; }
        public decimal? MonthlyIncome { get; set; }
        public int? EmploymentMonths { get; set; }
        public string? EmergencyContactName { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public string? EmergencyContactRelationship { get; set; }
        public string? PreviousLandlordName { get; set; }
        public string? PreviousLandlordPhone { get; set; }
        public int? NumberOfOccupants { get; set; }
        public bool? HasPets { get; set; }
        public string? PetDetails { get; set; }
        public bool? HasVehicles { get; set; }
        public string? VehicleDetails { get; set; }
        public DateTime? DesiredMoveInDate { get; set; }
        public string? AdditionalNotes { get; set; }
        
        // Background Check fields
        public bool? BackgroundCheckRequested { get; set; }
        public DateTime? BackgroundCheckRequestedAt { get; set; }
        public string? BackgroundCheckProvider { get; set; }
        public string? BackgroundCheckRequestId { get; set; }
        public string? BackgroundCheckStatus { get; set; }
        public DateTime? BackgroundCheckCompletedAt { get; set; }
        public int? CreditScore { get; set; }
        public bool? PassedCreditCheck { get; set; }
        public bool? PassedCriminalCheck { get; set; }
        public bool? PassedEvictionCheck { get; set; }
        public bool? PassedIncomeVerification { get; set; }
        public string? BackgroundCheckReportUrl { get; set; }
        public string? BackgroundCheckSummary { get; set; }
        public bool? BackgroundCheckOverallPass { get; set; }
        public string? BackgroundCheckRejectionReason { get; set; }
    }
}

