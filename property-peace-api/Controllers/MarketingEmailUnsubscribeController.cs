using brownstone_hub_api.Services.EmailService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[AllowAnonymous]
[Route(MarketingEmailUnsubscribeService.Route)]
public sealed class MarketingEmailUnsubscribeController(MarketingEmailUnsubscribeService unsubscribeService) : ControllerBase
{
    [HttpGet]
    public IActionResult Confirm() => Page(
        "Unsubscribe from marketing emails",
        """
        <p id="instructions">Confirm to stop receiving Property Peace marketing emails.</p>
        <form method="post">
          <input type="hidden" name="token" id="token">
          <button type="submit" id="confirm" disabled>Unsubscribe</button>
        </form>
        <noscript><p>Enable JavaScript and open the link in your email again.</p></noscript>
        <script>
          const token = window.location.hash.slice(1);
          if (token) {
            document.getElementById('token').value = token;
            document.getElementById('confirm').disabled = false;
          } else {
            document.getElementById('instructions').textContent = 'Open the unsubscribe link from your email.';
          }
        </script>
        """);

    [HttpPost]
    [RequestSizeLimit(4096)]
    public async Task<IActionResult> Unsubscribe([FromForm] string? token, CancellationToken cancellationToken)
    {
        if (await unsubscribeService.UnsubscribeAsync(token, cancellationToken))
        {
            return Page("You’re unsubscribed", "<p>You’ll no longer receive Property Peace marketing emails.</p>");
        }

        return Page("Invalid unsubscribe link", "<p>Open the unsubscribe link from your email and try again.</p>",
            StatusCodes.Status400BadRequest);
    }

    private ContentResult Page(string title, string body, int status = StatusCodes.Status200OK)
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";

        return new ContentResult
        {
            ContentType = "text/html; charset=utf-8",
            StatusCode = status,
            Content = $$"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>{{title}} | Property Peace</title>
              <style>
                body { margin: 0; padding: 40px 20px; font: 1rem/1.55 system-ui, sans-serif; background: #F4F7F5; color: #102C29; }
                main { max-width: 34rem; margin: auto; padding: 24px; background: #fff; border-radius: 12px; }
                h1 { margin: 0; font-size: 1.5rem; }
                button { font: inherit; padding: 10px 16px; background: #102C29; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
                button:disabled { opacity: .5; cursor: default; }
              </style>
            </head>
            <body><main><h1>{{title}}</h1>{{body}}</main></body>
            </html>
            """
        };
    }
}
