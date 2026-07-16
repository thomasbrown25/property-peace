namespace brownstone_hub_api.Dtos.ApplicationInvite
{
    public class AddApplicationInviteDto
    {
        public long PropertyId { get; set; }
        public long? UnitId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? ApplicantName { get; set; } // Optional - for email personalization
    }
}

