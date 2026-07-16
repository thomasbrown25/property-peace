namespace brownstone_hub_api.Dtos.LandlordInvite
{
    public class AddLandlordInviteDto
    {
        public string Email { get; set; } = string.Empty;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }
}
