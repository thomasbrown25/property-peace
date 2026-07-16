using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.User
{
    public class InviteLandlordDto
    {
        [Required(ErrorMessage = "Landlord email is required")]
        [EmailAddress(ErrorMessage = "Invalid landlord email address")]
        public string LandlordEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Tenant email is required")]
        [EmailAddress(ErrorMessage = "Invalid tenant email address")]
        public string TenantEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Tenant name is required")]
        public string TenantName { get; set; } = string.Empty;
    }
}
