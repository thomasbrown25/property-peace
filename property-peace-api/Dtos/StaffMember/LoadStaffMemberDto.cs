namespace brownstone_hub_api.Dtos.StaffMember
{
    public class LoadStaffMemberDto
    {
        public long Id { get; set; }
        public long? UserId { get; set; } // Nullable for placeholder staff members
        public string UserFirstName { get; set; } = string.Empty;
        public string UserLastName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty; // Computed from FirstName + LastName
        public long OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public decimal? HourlyRate { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        // For placeholder staff members (before invite is accepted)
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public bool HasAccount { get; set; } // True if UserId is not null
    }
}
