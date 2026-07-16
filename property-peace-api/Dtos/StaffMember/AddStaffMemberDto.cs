namespace brownstone_hub_api.Dtos.StaffMember
{
    public class AddStaffMemberDto
    {
        public long? UserId { get; set; } // Nullable for placeholder staff members
        public long OrganizationId { get; set; }
        public string Role { get; set; } = string.Empty;
        public decimal? HourlyRate { get; set; }
        // Fields for placeholder staff members (before invite is accepted)
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
    }
}
