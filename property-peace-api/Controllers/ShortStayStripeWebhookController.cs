using System.Text;
using System.Text.RegularExpressions;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace brownstone_hub_api.Controllers;

/// <summary>Dedicated Connect direct-charge endpoint. Configure a separate connected-account Stripe destination.</summary>
[ApiController]
[Route("api/short-stay/stripe/webhook")]
[AllowAnonymous]
public sealed class ShortStayStripeWebhookController(IConfiguration configuration,
    ShortStayPaymentReconciliationService reconciler) : ControllerBase
{
    private const int MaxBodyBytes = 256 * 1024;
    private static readonly Regex AccountPattern = new(@"\Aacct_[A-Za-z0-9]{16,}\z", RegexOptions.CultureInvariant);
    private static readonly Regex IntentPattern = new(@"\Api_[A-Za-z0-9]{16,}\z", RegexOptions.CultureInvariant);
    private static readonly Regex CodePattern = new(@"\A[A-Z0-9]{4,64}\z", RegexOptions.CultureInvariant);

    [HttpPost]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Post()
    {
        var secret = configuration["ShortStayBooking:ConnectWebhookSecret"];
        var key = configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret) ||
            !(key?.StartsWith("sk_test_", StringComparison.Ordinal) == true ||
              key?.StartsWith("sk_live_", StringComparison.Ordinal) == true))
            return StatusCode(503);

        if (Request.ContentLength > MaxBodyBytes) return StatusCode(413);
        var signature = Request.Headers["Stripe-Signature"].ToString();
        if (string.IsNullOrWhiteSpace(signature) || signature.Length > 4096) return BadRequest();
        string body;
        try
        {
            // One bounded read; never enable buffering, spill to disk, or read an unbounded text stream.
            var bytes = new byte[MaxBodyBytes + 1];
            var count = 0;
            while (count < bytes.Length)
            {
                var read = await Request.Body.ReadAsync(bytes.AsMemory(count), HttpContext.RequestAborted);
                if (read == 0) break;
                count += read;
            }
            if (count > MaxBodyBytes) return StatusCode(413);
            if (count == 0) return BadRequest();
            body = new UTF8Encoding(false, true).GetString(bytes, 0, count);
        }
        catch (DecoderFallbackException) { return BadRequest(); }
        catch (IOException) { return StatusCode(503); }

        Event evt;
        try
        {
            // Stripe.NET verifies the HMAC, timestamp and exact SDK API version before deserialization.
            evt = EventUtility.ConstructEvent(body, signature, secret, tolerance: 300,
                throwOnApiVersionMismatch: true);
        }
        catch (StripeException) { return BadRequest(); }
        catch (Exception) when (!HttpContext.RequestAborted.IsCancellationRequested) { return BadRequest(); }

        // Some Stripe.NET versions reject only past signatures. Enforce both sides of the replay window.
        var timestamps = signature.Split(',').Where(part => part.StartsWith("t=", StringComparison.Ordinal)).ToArray();
        if (timestamps.Length != 1 || !long.TryParse(timestamps[0].AsSpan(2), out var timestamp) ||
            Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - (double)timestamp) > 300)
            return BadRequest();

        if (evt.Livemode != key!.StartsWith("sk_live_", StringComparison.Ordinal)) return BadRequest();
        if (evt.Account is null || !AccountPattern.IsMatch(evt.Account)) return BadRequest();
        var kind = evt.Type switch
        {
            "payment_intent.succeeded" => VerifiedShortStayPaymentKind.Succeeded,
            "payment_intent.canceled" => VerifiedShortStayPaymentKind.Canceled,
            "payment_intent.payment_failed" => VerifiedShortStayPaymentKind.PaymentFailed,
            _ => (VerifiedShortStayPaymentKind?)null
        };
        if (kind is null) return Ok(); // Signed, connected, unsupported: no money mutation.
        if (evt.Data?.Object is not PaymentIntent pi || pi.Id is null || !IntentPattern.IsMatch(pi.Id) ||
            pi.Amount is < 50 or > 200_000 || pi.Currency != "usd" ||
            pi.Metadata?.GetValueOrDefault("reservation_code") is not { } code || !CodePattern.IsMatch(code))
            return BadRequest();
        try
        {
            var outcome = await reconciler.ReconcileAsync(new VerifiedShortStayPaymentEvent(
                kind.Value, evt.Account, pi.Id, code), HttpContext.RequestAborted);
            return StatusCode(outcome.StatusCode);
        }
        catch (Exception) when (!HttpContext.RequestAborted.IsCancellationRequested)
        {
            // No raw payload, credentials or client secrets in logs/responses.
            return StatusCode(503);
        }
    }
}
