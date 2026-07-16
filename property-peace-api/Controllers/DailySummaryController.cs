using brownstone_hub_api.Models;
using brownstone_hub_api.Services.DailySummaryEmailService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/daily-summary")]
    public class DailySummaryController(
        IDailySummaryEmailService dailySummaryEmailService,
        ILogger<DailySummaryController> logger) : ControllerBase
    {
        private readonly IDailySummaryEmailService _dailySummaryEmailService = dailySummaryEmailService;
        private readonly ILogger<DailySummaryController> _logger = logger;

        [AllowAnonymous]
        [HttpGet("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromQuery] string token, CancellationToken cancellationToken)
        {
            var unsubscribed = await _dailySummaryEmailService.UnsubscribeAsync(token, cancellationToken);
            if (!unsubscribed)
            {
                _logger.LogWarning("Invalid daily summary unsubscribe token used.");
                return BadRequest(new ServiceResponse<bool>
                {
                    Success = false,
                    Data = false,
                    Message = "This unsubscribe link is invalid or has expired."
                });
            }

            const string html = """
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <title>Unsubscribed - Property Peace</title>
  <style>
    body { margin:0; padding:40px 20px; background:#f4f7fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; color:#172033; }
    .card { max-width:560px; margin:0 auto; background:#fff; border:1px solid #e6edf5; border-radius:16px; padding:34px; box-shadow:0 12px 30px rgba(20,100,204,.10); }
    h1 { margin:0 0 12px; color:#1464cc; }
    p { line-height:1.6; }
  </style>
</head>
<body>
  <div class='card'>
    <h1>You’re unsubscribed</h1>
    <p>Daily Summary Emails have been disabled for your Property Peace account.</p>
    <p>You can turn them back on anytime from <strong>Settings → Notifications</strong>.</p>
  </div>
</body>
</html>
""";
            return Content(html, "text/html");
        }
    }
}
