using brownstone_hub_api.Attributes;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/extended-stay-agreements")]
[Authorize(Roles = "Landlord,Admin")]
[RequireOrganizationRole("Owner")]
public sealed class ExtendedStayAgreementController(ExtendedStayAgreementService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(long unitId, CancellationToken ct)
    {
        var result = await service.List(unitId, ct);
        return StatusCode(result.StatusCode, result);
    }
    [HttpPost]
    public async Task<IActionResult> Create(long unitId, [FromBody] CreateExtendedStayAgreement request, CancellationToken ct)
    {
        var result = await service.Create(unitId, request, ct);
        return StatusCode(result.StatusCode, result);
    }
}
