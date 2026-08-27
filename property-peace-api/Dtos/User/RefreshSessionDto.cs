namespace brownstone_hub_api.Dtos.User
{
    public class RefreshSessionDto
    {
        public LoadUserDto User { get; set; } = null!;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime RefreshTokenExpiresAt { get; set; }
        public bool IsPersistent { get; set; }
    }
}
