namespace brownstone_hub_api.Dtos.StaffMember
{
    public class AcceptStaffMemberInviteDto
    {
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
