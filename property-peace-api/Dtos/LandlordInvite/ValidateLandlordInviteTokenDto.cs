namespace brownstone_hub_api.Dtos.LandlordInvite
{
    public class ValidateLandlordInviteTokenDto
    {
        public bool IsValid { get; set; }
        public string? Message { get; set; }
        public string? Email { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
