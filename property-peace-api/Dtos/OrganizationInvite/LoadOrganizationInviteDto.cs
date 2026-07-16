
namespace brownstone_hub_api.Dtos.OrganizationInvite
{
    public class LoadOrganizationInviteDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public long InvitedBy { get; set; }
        public string InvitedByName { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsAccepted { get; set; }
        public DateTime? AcceptedAt { get; set; }
        public long? AcceptedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool HasAccount { get; set; } // True if a user with this email already exists
    }
}

