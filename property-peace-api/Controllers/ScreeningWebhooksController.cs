using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Services.Screening;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/screenings/webhooks/{providerKey}")]
[AllowAnonymous]
public sealed class ScreeningWebhooksController : ControllerBase
{
    public const int MaximumBodyBytes = 1024 * 1024;
    private readonly ITenantScreeningService _screening;
    public ScreeningWebhooksController(ITenantScreeningService screening) => _screening = screening;

    [HttpPost]
    [RequestSizeLimit(MaximumBodyBytes)]
    public async Task<IActionResult> Receive(string providerKey, CancellationToken ct)
    {
        if (!ValidProviderKey(providerKey)) return NotFound();
        if (Request.ContentLength > MaximumBodyBytes) return StatusCode(StatusCodes.Status413PayloadTooLarge);
        byte[] payload;
        await using (var buffer = new MemoryStream())
        {
            var chunk = new byte[81920];
            int read;
            while ((read = await Request.Body.ReadAsync(chunk.AsMemory(0, chunk.Length), ct)) != 0)
            {
                if (buffer.Length + read > MaximumBodyBytes) return StatusCode(StatusCodes.Status413PayloadTooLarge);
                await buffer.WriteAsync(chunk.AsMemory(0, read), ct);
            }
            payload = buffer.ToArray();
        }
        var headers = Request.Headers.Select(x => new KeyValuePair<string, IEnumerable<string>>(
            x.Key, x.Value.Select(value => value ?? string.Empty).ToArray())).ToArray();
        try
        {
            await _screening.ApplyVerifiedCallbackAsync(providerKey, new ScreeningCallbackRequest(payload, headers), ct);
            return Accepted(new { status = "accepted" });
        }
        catch (ScreeningUnavailableException) { return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Tenant screening is temporarily unavailable." }); }
        catch (Exception ex) when (ex is UnauthorizedAccessException or ArgumentException or ScreeningWebhookIntegrityException)
        { return Unauthorized(new { message = "Webhook could not be accepted." }); }
    }

    private static bool ValidProviderKey(string value) => value.Length is > 0 and <= 100 &&
        value.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');
}
