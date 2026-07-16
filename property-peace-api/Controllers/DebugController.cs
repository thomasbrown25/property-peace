using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DebugController : ControllerBase
    {

        [Authorize]
        [HttpGet("crash")]
        public ActionResult<string> Crash()
        {
            Environment.FailFast("Intentional app crash");
            return "App has crashed";
        }

        [Authorize]
        [HttpGet("throw-500")]
        public async Task<ActionResult<ServiceResponse<string>>> Throw500()
        {
            return StatusCode(500, "This is an error message");
        }
    }
}