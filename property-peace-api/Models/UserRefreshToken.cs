namespace brownstone_hub_api.Models
{
    public class UserRefreshToken
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string TokenHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public bool IsPersistent { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? ReplacedByTokenHash { get; set; }
        public User User { get; set; } = null!;
    }
}
