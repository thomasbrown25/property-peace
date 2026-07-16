using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.User
{
    public class SendVerificationCodeDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string Email { get; set; } = string.Empty;
    }
}
