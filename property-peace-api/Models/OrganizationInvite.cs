
namespace brownstone_hub_api.Models
{
    public class OrganizationInvite
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "Viewer"; // Role they'll have when they accept
        public string Token { get; set; } = string.Empty; // Unique invite token
        public long InvitedBy { get; set; } // UserId
        public User InvitedByUser { get; set; } = null!;
        
        public DateTime ExpiresAt { get; set; }
        public bool IsAccepted { get; set; } = false;
        public DateTime? AcceptedAt { get; set; }
        public long? AcceptedBy { get; set; } // UserId who accepted
        public User? AcceptedByUser { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

