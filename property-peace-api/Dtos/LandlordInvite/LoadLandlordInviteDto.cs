namespace brownstone_hub_api.Dtos.LandlordInvite
{
    public class LoadLandlordInviteDto
    {
        public long Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string InviteToken { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedAt { get; set; }
        public long CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
