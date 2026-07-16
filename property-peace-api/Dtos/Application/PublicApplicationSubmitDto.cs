namespace brownstone_hub_api.Dtos.Application
{
    public class PublicApplicationSubmitDto
    {
        public string ListingNumber { get; set; } = string.Empty;

        // Applicant Information
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }

        // Application Details
        public DateTime? DesiredMoveInDate { get; set; }
        public int? NumberOfOccupants { get; set; }
        public bool HasPets { get; set; } = false;
        public string? PetDetails { get; set; }
        public string? AdditionalNotes { get; set; }
    }
}
