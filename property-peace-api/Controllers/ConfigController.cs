using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConfigController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public ConfigController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Get public configuration values needed by clients (e.g., Google Client ID)
        /// This endpoint is public and doesn't require authentication
        /// </summary>
        [HttpGet("public")]
        [AllowAnonymous]
        public IActionResult GetPublicConfig()
        {
            var googleClientId = _configuration["GoogleOAuth:ClientId"] ?? string.Empty;

            return Ok(new
            {
                googleClientId = googleClientId
            });
        }
    }
}
