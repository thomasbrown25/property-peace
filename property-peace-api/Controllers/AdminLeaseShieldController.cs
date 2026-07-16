using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Repositories.LeaseShield;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/lease-shield")]
    [Authorize(Roles = "Admin")]
    public class AdminLeaseShieldController : ControllerBase
    {
        private static readonly string[] AllStateCodes = new[]
        {
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
        };

        private readonly ILeaseShieldStateLawSourceRepository _sourceRepository;

        public AdminLeaseShieldController(ILeaseShieldStateLawSourceRepository sourceRepository)
        {
            _sourceRepository = sourceRepository;
        }

        [HttpGet("sources")]
        public async Task<IActionResult> GetStateLawSources(CancellationToken cancellationToken = default)
        {
            var list = await _sourceRepository.GetAllAsync(cancellationToken);
            var data = list.Select(x => new
            {
                id = x.Id,
                state = x.State,
                baseUrl = x.BaseUrl,
                contentUrl = x.ContentUrl,
                description = x.Description,
                updatedAt = x.UpdatedAt
            }).ToList();
            return Ok(new { success = true, data });
        }

        [HttpPut("sources")]
        public async Task<IActionResult> UpsertStateLawSource([FromBody] UpsertLeaseShieldSourceRequest request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request?.State))
                return BadRequest(new { success = false, message = "State is required" });
            var state = request.State.Trim().ToUpperInvariant();
            if (!AllStateCodes.Contains(state))
                return BadRequest(new { success = false, message = "Invalid state code" });
            var updated = await _sourceRepository.UpsertAsync(state, request.BaseUrl, request.Description, request.ContentUrl, cancellationToken);
            return Ok(new
            {
                success = true,
                data = new
                {
                    id = updated.Id,
                    state = updated.State,
                    baseUrl = updated.BaseUrl,
                    contentUrl = updated.ContentUrl,
                    description = updated.Description,
                    updatedAt = updated.UpdatedAt
                }
            });
        }

        [HttpDelete("sources/{state}")]
        public async Task<IActionResult> DeleteStateLawSource(string state, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(state))
                return BadRequest(new { success = false, message = "State is required" });
            var deleted = await _sourceRepository.DeleteByStateAsync(state, cancellationToken);
            if (!deleted)
                return NotFound(new { success = false, message = "State law source not found" });
            return Ok(new { success = true });
        }
    }

    public class UpsertLeaseShieldSourceRequest
    {
        public string? State { get; set; }
        public string? BaseUrl { get; set; }
        /// <summary>Optional URL to fetch for AI context (e.g. specific statute section). When set, this page's text is injected into the prompt.</summary>
        public string? ContentUrl { get; set; }
        public string? Description { get; set; }
    }
}
