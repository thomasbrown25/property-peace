using brownstone_hub_api.Attributes;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/short-stay/units/{unitId:long}/listing/photos")]
[Authorize(Roles = "Landlord,Admin")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ShortStayListingPhotoController(ShortStayListingPhotoService photos) : ControllerBase
{
    [HttpGet]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> List(long unitId, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var result = await photos.List(unitId, ct);
        return StatusCode(result.StatusCode, result);
    }
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(21 * 1024 * 1024)]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Upload(long unitId, [FromForm] List<IFormFile> files, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var result = await photos.Upload(unitId, files, ct);
        return StatusCode(result.StatusCode, result);
    }
    [HttpDelete("{photoId:long}")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> Delete(long unitId, long photoId, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var result = await photos.Delete(unitId, photoId, ct);
        return StatusCode(result.StatusCode, result);
    }
    [HttpPut("{photoId:long}/cover")]
    [RequireOrganizationRole("Owner", "Manager")]
    public async Task<IActionResult> SetCover(long unitId, long photoId, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var result = await photos.SetCover(unitId, photoId, ct);
        return StatusCode(result.StatusCode, result);
    }
}
