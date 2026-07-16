
namespace brownstone_hub_api.Dtos.Client
{
    public class ValidateClientInviteTokenDto
    {
        public bool IsValid { get; set; }
        public string? Email { get; set; }
        public long? ClientId { get; set; }
        public string? Message { get; set; }
        public LoadClientDto? Client { get; set; }
        public string? OrganizationName { get; set; }
        public string? LandlordName { get; set; }
    }
}
