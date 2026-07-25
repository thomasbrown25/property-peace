namespace brownstone_hub_api.Models
{
    public class PasskeyCeremony
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Type { get; set; } = string.Empty;
        public long? UserId { get; set; }
        public string OptionsJson { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
