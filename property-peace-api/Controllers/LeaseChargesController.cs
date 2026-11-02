using System.Globalization;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers;

/// <summary>Append-only manual charges for long-term leases; never creates payment receipts.</summary>
[ApiController]
[Authorize(Roles = "Landlord,Admin")]
[Route("api/Lease/{leaseId:long}")]
public sealed class LeaseChargesController(DataContext db) : ControllerBase
{
    public sealed record ManualChargeRequest(string? Name, decimal? Amount, string? DueDate);

    [HttpGet("charge-definitions")]
    public async Task<IActionResult> GetChargeDefinitions(long leaseId, CancellationToken ct)
    {
        var org = await AuthorizedOrganization(ct);
        if (org == 0) return Forbid();

        var lease = await ScopedLease(leaseId, org).Select(l => new
        {
            l.Id, l.RentAmount, l.RentFrequency, l.RentDueDay, l.StartDate,
            l.DepositAmount, l.PetDepositAmount
        }).SingleOrDefaultAsync(ct);
        if (lease is null) return NotFound(new { message = "Lease not found" });

        var fees = await db.LeaseFees.AsNoTracking()
            .Where(f => f.LeaseId == leaseId && (f.OrganizationId == null || f.OrganizationId == org))
            .OrderBy(f => f.Id)
            .Select(f => new { f.Id, f.Name, f.Amount, f.DueDate, f.IsLateFee })
            .ToListAsync(ct);
        var leaseDeposits = await db.LeaseDeposits.AsNoTracking()
            .Where(d => d.LeaseId == leaseId && (d.OrganizationId == null || d.OrganizationId == org))
            .OrderBy(d => d.SortOrder).ThenBy(d => d.Id)
            .Select(d => new { d.Id, d.Name, d.Amount, d.DueDate })
            .ToListAsync(ct);
        return Ok(new { success = true, data = new
        {
            lease.Id, lease.RentAmount, lease.RentFrequency, lease.RentDueDay, lease.StartDate,
            lease.DepositAmount, lease.PetDepositAmount, Fees = fees, LeaseDeposits = leaseDeposits
        } });
    }

    [HttpPost("fees")]
    public Task<IActionResult> AddFee(long leaseId, [FromBody] ManualChargeRequest request, CancellationToken ct) =>
        AddCharge(leaseId, request, deposit: false, ct);

    [HttpPost("deposits")]
    public Task<IActionResult> AddDeposit(long leaseId, [FromBody] ManualChargeRequest request, CancellationToken ct) =>
        AddCharge(leaseId, request, deposit: true, ct);

    private async Task<IActionResult> AddCharge(long leaseId, ManualChargeRequest request, bool deposit, CancellationToken ct)
    {
        // Do not trust a client-supplied organization or a role claim alone.
        var org = await AuthorizedOrganization(ct);
        if (org == 0) return Forbid();

        var name = request?.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200 || name.Any(char.IsControl) ||
            request?.Amount is not decimal amount || amount <= 0 || amount > 9999999999999999.99m ||
            decimal.Round(amount, 2) != amount || !TryDueDate(request.DueDate, out var dueDate))
            return BadRequest(new { message = "Enter a name (up to 200 characters), a positive amount in cents, and a valid due date." });

        // Query through the lease's unit/property so cross-org and short-stay records cannot be charged.
        var exists = await ScopedLease(leaseId, org).AnyAsync(ct);
        if (!exists) return NotFound(new { message = "Lease not found" });

        if (deposit)
        {
            var charge = new LeaseDeposit { LeaseId = leaseId, OrganizationId = org, Name = name,
                Amount = amount, DueDate = dueDate };
            db.LeaseDeposits.Add(charge);
            await db.SaveChangesAsync(ct);
            return StatusCode(201, new { success = true, data = new { charge.Id, charge.LeaseId, charge.Name, charge.Amount, charge.DueDate } });
        }
        else
        {
            var charge = new LeaseFee { LeaseId = leaseId, OrganizationId = org, Name = name,
                Amount = amount, DueDate = dueDate, IsLateFee = false };
            db.LeaseFees.Add(charge);
            await db.SaveChangesAsync(ct);
            return StatusCode(201, new { success = true, data = new { charge.Id, charge.LeaseId, charge.Name, charge.Amount, charge.DueDate, charge.IsLateFee } });
        }
    }

    private IQueryable<Lease> ScopedLease(long leaseId, long org) => db.Leases.AsNoTracking().Where(l => l.Id == leaseId && !l.IsDeleted &&
            l.OrganizationId == org && l.Unit.RentalMode == ERentalMode.LongTerm &&
            (l.Unit.OrganizationId == null || l.Unit.OrganizationId == org) &&
            !l.Unit.Property.IsDeleted && l.Unit.Property.OrganizationId == org);

    private async Task<long> AuthorizedOrganization(CancellationToken ct)
    {
        var org = HttpContext.Items.TryGetValue("OrganizationId", out var scope) && scope is long orgId ? orgId : 0;
        var user = HttpContext.Items.TryGetValue("UserId", out var principal) && principal is long userId ? userId : 0;
        if (org <= 0 || user <= 0) return 0;
        var permitted = await db.OrganizationMembers.AsNoTracking().AnyAsync(m =>
            m.OrganizationId == org && m.UserId == user && m.IsActive &&
            (m.Role == "Owner" || m.Role == "Admin" || m.Role == "Manager" && m.CanManageLeases) &&
            m.Organization.IsActive, ct);
        return permitted ? org : 0;
    }

    private static bool TryDueDate(string? input, out DateTime date)
    {
        date = default;
        // The Charges tab sends a local calendar date at midnight, without an offset.
        if (input is null || !DateTime.TryParseExact(input,
                ["yyyy-MM-dd", "yyyy-MM-dd'T'HH:mm:ss"], CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed) || parsed.TimeOfDay != TimeSpan.Zero ||
            parsed < new DateTime(1753, 1, 1)) return false;
        date = parsed.Date;
        return true;
    }
}
