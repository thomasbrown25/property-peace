namespace brownstone_hub_api.Dtos.StaffMember
{
    public class AddStaffMemberInviteDto
    {
        public long StaffMemberId { get; set; }
        public string Email { get; set; } = string.Empty;
    }
}
