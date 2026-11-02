using System.Security.Claims;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Authorize(Roles = "Landlord,Admin")]
[Route("api/short-stay/bookings")]
public sealed class ShortStayBookingsController(DataContext db) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Get([FromQuery] int page = 1, [FromQuery] string? search = null,
        [FromQuery] string? status = null, [FromQuery] string? period = null, CancellationToken ct = default)
    {
        Response.Headers.CacheControl = "no-store, no-cache";
        if (!HttpContext.Items.TryGetValue("OrganizationId", out var org) || org is not long orgId || orgId <= 0 ||
            !HttpContext.Items.TryGetValue("UserId", out var actor) || actor is not long userId || userId <= 0 ||
            !long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return Forbid();
        if (page < 1 || page > 100000 || search?.Length > 100 ||
            (period is not null && period is not ("upcoming" or "past")) ||
            (status is not null && !Enum.TryParse<ShortStayReservationStatus>(status, true, out _)))
            return BadRequest();
        var canManage = await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == orgId &&
            m.UserId == userId && m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);
        if (!canManage) return Forbid();

        var query = from booking in db.ShortStayReservations.AsNoTracking()
                    join unit in db.Units.AsNoTracking() on booking.UnitId equals unit.Id
                    join guest in db.Users.AsNoTracking() on booking.GuestUserId equals guest.Id
                    where booking.OrganizationId == orgId && unit.PropertyId == booking.PropertyId &&
                          unit.Property.OrganizationId == orgId && !unit.Property.IsDeleted &&
                          (unit.OrganizationId == null || unit.OrganizationId == orgId)
                    select new { booking, unit, guest };
        if (!string.IsNullOrWhiteSpace(status))
        {
            var selected = Enum.Parse<ShortStayReservationStatus>(status, true);
            query = query.Where(row => row.booking.Status == selected);
        }
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (period == "upcoming") query = query.Where(row => row.booking.CheckOutDate >= today);
        if (period == "past") query = query.Where(row => row.booking.CheckOutDate < today);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(row => row.booking.PublicCode.Contains(term) ||
                row.guest.FirstName.Contains(term) || row.guest.LastName.Contains(term) ||
                row.guest.Email.Contains(term) || row.unit.Name.Contains(term) ||
                (row.unit.Property.Name != null && row.unit.Property.Name.Contains(term)));
        }
        const int pageSize = 10;
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(row => row.booking.CreatedAtUtc)
            .ThenByDescending(row => row.booking.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(row => new {
                row.booking.Id, row.booking.PublicCode, Status = row.booking.Status.ToString(),
                row.booking.PropertyId, PropertyName = row.unit.Property.Name, row.booking.UnitId,
                UnitName = row.unit.Name, GuestName = row.guest.FirstName + " " + row.guest.LastName,
                GuestEmail = row.guest.Email, row.booking.CheckInDate, row.booking.CheckOutDate,
                row.booking.GuestCount, row.booking.TotalCents, row.booking.Currency,
                row.booking.CreatedAtUtc
            }).ToListAsync(ct);
        return Ok(new { items = rows, total, page, pageSize });
    }
}
