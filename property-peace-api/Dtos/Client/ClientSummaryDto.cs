
namespace brownstone_hub_api.Dtos.Client
{
    public class ClientSummaryDto
    {
        public long Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? CompanyName { get; set; }
        public int PropertyCount { get; set; }
        public bool HasPortalAccess { get; set; }
    }
}
