

namespace brownstone_hub_api.Utils
{
    public class JwtSettings
    {
        public string SecretKey { get; set; }
        public string Issuer { get; set; }
        public string Audience { get; set; }
        /// <summary>JWT lifetime in minutes. Set in appsettings.json and optionally .vscode/launch.json or Azure App Configuration. Used in UserService.CreateToken.</summary>
        public int ExpiresInMinutes { get; set; }
    }
}