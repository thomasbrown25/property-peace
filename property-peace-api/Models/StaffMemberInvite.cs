namespace brownstone_hub_api.Models
{
    public class StaffMemberInvite
    {
        public long Id { get; set; }
        public long StaffMemberId { get; set; }
        public StaffMember StaffMember { get; set; } = null!;
        
        // Organization ownership
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        public string InviteToken { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
        public DateTime? UsedAt { get; set; }
        public long CreatedBy { get; set; } // Landlord UserId
        public User CreatedByUser { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
