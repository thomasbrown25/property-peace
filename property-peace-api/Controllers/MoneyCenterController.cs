using brownstone_hub_api.Attributes;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.MoneyCenter;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/money-center")]
[Authorize(Roles = "Landlord,Admin")]
[RequireOrganizationRole("Owner", "Manager")]
public sealed class MoneyCenterController(IMoneyCenterService service, TimeProvider? timeProvider = null) : ControllerBase
{
    private readonly IMoneyCenterService _service = service;
    private readonly TimeProvider _clock = timeProvider ?? TimeProvider.System;

    [HttpGet]
    public async Task<IActionResult> GetOverview([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] long? propertyId, [FromQuery] long? unitId, [FromQuery] int upcomingDays = 30,
        [FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        var organizationId = this.GetCurrentOrganizationIdOrForbid();
        if (!organizationId.HasValue) return OrganizationRequired();
        try
        {
            return Ok(await _service.GetOverviewAsync(organizationId.Value,
                CreateQuery(from, to, propertyId, unitId, upcomingDays, limit), cancellationToken));
        }
        catch (MoneyCenterValidationException ex) { return BadRequest(new { Message = ex.Message }); }
        catch (MoneyCenterScopeException ex) { return NotFound(new { Message = ex.Message }); }
    }

    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] long? propertyId, [FromQuery] long? unitId, [FromQuery] int upcomingDays = 30,
        [FromQuery] int limit = 100, CancellationToken cancellationToken = default)
    {
        var organizationId = this.GetCurrentOrganizationIdOrForbid();
        if (!organizationId.HasValue) return OrganizationRequired();
        try
        {
            return Ok(await _service.GetItemsAsync(organizationId.Value,
                CreateQuery(from, to, propertyId, unitId, upcomingDays, limit), cancellationToken));
        }
        catch (MoneyCenterValidationException ex) { return BadRequest(new { Message = ex.Message }); }
        catch (MoneyCenterScopeException ex) { return NotFound(new { Message = ex.Message }); }
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] long? propertyId, [FromQuery] long? unitId, [FromQuery] int upcomingDays = 30,
        CancellationToken cancellationToken = default)
    {
        var organizationId = this.GetCurrentOrganizationIdOrForbid();
        if (!organizationId.HasValue) return OrganizationRequired();
        try
        {
            var export = await _service.ExportAsync(organizationId.Value,
                CreateQuery(from, to, propertyId, unitId, upcomingDays, 1000), cancellationToken);
            return File(export.Content, export.ContentType, export.FileName);
        }
        catch (MoneyCenterValidationException ex) { return BadRequest(new { Message = ex.Message }); }
        catch (MoneyCenterScopeException ex) { return NotFound(new { Message = ex.Message }); }
    }

    private MoneyCenterQuery CreateQuery(DateTimeOffset? from, DateTimeOffset? to, long? propertyId,
        long? unitId, int upcomingDays, int limit)
    {
        var now = _clock.GetUtcNow();
        var defaultFrom = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        return new(from ?? defaultFrom, to ?? defaultFrom.AddMonths(1), propertyId, unitId, upcomingDays, limit);
    }

    private ObjectResult OrganizationRequired() => StatusCode(StatusCodes.Status403Forbidden,
        new { Message = "Validated active organization context is required" });
}
