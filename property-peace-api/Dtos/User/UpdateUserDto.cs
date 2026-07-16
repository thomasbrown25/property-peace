namespace brownstone_hub_api.Dtos.User
{
    public class UpdateUserDto
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? Company { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        
        // Business Information
        public string? BusinessName { get; set; }
        public string? BusinessEmail { get; set; }
        public string? BusinessPhone { get; set; }
        
        // Account Information
        public string? AuthProvider { get; set; }
        public bool? HasSeenTutorial { get; set; }
    }
}

