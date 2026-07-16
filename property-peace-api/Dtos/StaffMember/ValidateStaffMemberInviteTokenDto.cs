namespace brownstone_hub_api.Dtos.StaffMember
{
    public class ValidateStaffMemberInviteTokenDto
    {
        public bool IsValid { get; set; }
        public string Message { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public long StaffMemberId { get; set; }
        public LoadStaffMemberDto? StaffMember { get; set; }
        public string? OrganizationName { get; set; }
        public string? LandlordName { get; set; }
    }
}
