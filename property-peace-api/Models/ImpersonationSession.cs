namespace brownstone_hub_api.Models
{
    public class ImpersonationSession
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public long ActorUserId { get; set; }
        public long TargetUserId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? SupportReference { get; set; }
        public string RefreshTokenHash { get; set; } = string.Empty;
        public string? PreviousRefreshTokenHash { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime? StoppedAt { get; set; }
        public string? StopReason { get; set; }

    }
}
