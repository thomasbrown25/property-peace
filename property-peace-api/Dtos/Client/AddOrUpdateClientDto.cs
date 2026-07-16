
namespace brownstone_hub_api.Dtos.Client
{
    public class AddOrUpdateClientDto
    {
        public long? Id { get; set; }
        public long OrganizationId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public string? CompanyName { get; set; }
        public long? UserId { get; set; } // Portal access user account (nullable)
        public decimal? ManagementFeePercentage { get; set; }
        public decimal? ManagementFeeFlat { get; set; }
        public string StatementFrequency { get; set; } = "Monthly";
        public bool IsActive { get; set; } = true;
        public bool SendInvite { get; set; } = false; // Whether to send invitation email
    }
}
