namespace brownstone_hub_api.Models
{
    public class PasskeyCredential
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public User User { get; set; } = null!;
        public string CredentialId { get; set; } = string.Empty;
        public string CredentialIdHash { get; set; } = string.Empty;
        public byte[] PublicKey { get; set; } = [];
        public byte[] UserHandle { get; set; } = [];
        public long SignatureCounter { get; set; }
        public Guid AaGuid { get; set; }
        public string Name { get; set; } = "Passkey";
        public bool IsBackupEligible { get; set; }
        public bool IsBackedUp { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastUsedAt { get; set; }
    }
}
