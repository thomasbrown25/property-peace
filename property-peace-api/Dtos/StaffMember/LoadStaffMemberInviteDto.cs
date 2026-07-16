namespace brownstone_hub_api.Dtos.StaffMember
{
    public class LoadStaffMemberInviteDto
    {
        public long Id { get; set; }
        public long StaffMemberId { get; set; }
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedAt { get; set; }
        public long CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public LoadStaffMemberDto? StaffMember { get; set; }
    }
}
