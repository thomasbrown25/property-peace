using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers;

// A guest's receipt is deliberately independent of booking/payment rollout flags and organization selection.
[ApiController]
[Authorize]
[Route("api/short-stay/holds")]
public sealed class ShortStayReservationStatusController(DataContext db, IHttpContextAccessor context) : ControllerBase
{
    [HttpGet("{code}")]
    public async Task<IActionResult> Get(string code, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store, no-cache";
        Response.Headers.Pragma = "no-cache";
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("UserId", out var actor) != true || actor is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return Forbid();
        if (code is not { Length: 32 } || code.Any(c => !((c >= '0' && c <= '9') ||
            (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')))) return BadRequest();

        // Filter by the authenticated guest in SQL; neither possession of a code nor landlord/admin
        // permissions grant access. Explicit projection prevents payment identifiers and PII leaking.
        var reservation = await db.ShortStayReservations.AsNoTracking()
            .Where(r => r.PublicCode == code && r.GuestUserId == userId)
            .Select(r => new { r.PublicCode, r.Status, r.CheckInDate, r.CheckOutDate, r.GuestCount,
                r.NightlySubtotalCents, r.CleaningFeeCents, r.TaxCents, r.TotalCents, r.HoldExpiresAtUtc })
            .SingleOrDefaultAsync(ct);
        if (reservation is null) return NotFound();
        var message = reservation.Status switch
        {
            ShortStayReservationStatus.Held => "Your hold is awaiting payment; check the hold expiry before paying.",
            ShortStayReservationStatus.PendingPayment => "Payment has started but is not complete yet.",
            ShortStayReservationStatus.Processing => "Payment is processing; your reservation is not yet complete.",
            ShortStayReservationStatus.Confirmed => "Your reservation is confirmed.",
            ShortStayReservationStatus.RefundRequired => "A refund is required; contact support if you need help.",
            ShortStayReservationStatus.Failed => "Payment failed; this reservation is not active.",
            ShortStayReservationStatus.Expired => "This hold has expired and is not active.",
            ShortStayReservationStatus.Refunded => "This reservation was refunded and is not active.",
            ShortStayReservationStatus.Disputed => "This payment is disputed; contact support for help.",
            _ => "This reservation is not yet complete."
        };
        return Ok(new { publicCode = reservation.PublicCode, status = reservation.Status.ToString(),
            checkIn = reservation.CheckInDate, checkOut = reservation.CheckOutDate, guestCount = reservation.GuestCount,
            nightlySubtotalCents = reservation.NightlySubtotalCents, cleaningFeeCents = reservation.CleaningFeeCents,
            taxCents = reservation.TaxCents, totalCents = reservation.TotalCents,
            holdExpiresAt = reservation.HoldExpiresAtUtc, message });
    }
}
