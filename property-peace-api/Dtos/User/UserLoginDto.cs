

namespace brownstone_hub_api.Dtos.User
{
    public class UserLoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; }
        public Models.MfaMethod? MfaMethod { get; set; }
    }
}