using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Authorize]
[Route("api/short-stay/holds")]
public sealed class ShortStayPaymentController(ShortStayStartPaymentService payments, IConfiguration config) : ControllerBase
{
    [HttpPost("{code}/start-payment")]
    public async Task<IActionResult> StartPayment(string code, CancellationToken ct)
    {
        // Never allow a browser, caller, or cache to select an amount, account, or recipient.
        Response.Headers.CacheControl = "no-store, no-cache";
        Response.Headers.Pragma = "no-cache";
        var mode = config["ShortStayBooking:StripeMode"];
        var key = config["Stripe:PublishableKey"];
        var prefix = mode switch { "Test" => "pk_test_", "Live" => "pk_live_", _ => null };
        if (prefix is null || key?.StartsWith(prefix, StringComparison.Ordinal) != true || key.Length <= prefix.Length)
            return StatusCode(503, new { reason = "stripe_unavailable" });
        var result = await payments.Start(code, ct);
        if (result.StatusCode == 200 && result.Payment is { ClientSecret: { Length: > 0 } secret, ConnectedAccountId: { } account } payment &&
            account.StartsWith("acct_", StringComparison.Ordinal))
            return Ok(new { payment.PaymentIntentId, ClientSecret = secret, payment.ExpiresAtUtc,
                ConnectedAccountId = account, PublishableKey = key });
        return StatusCode(result.StatusCode == 200 ? 503 : result.StatusCode,
            new { reason = result.Reason ?? "payment_unavailable" });
    }
}
