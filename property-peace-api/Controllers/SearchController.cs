using brownstone_hub_api.Services.SearchService;
using brownstone_hub_api.Dtos.Search;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class SearchController(ISearchService searchService) : ControllerBase
    {
        private readonly ISearchService _searchService = searchService;

        [HttpGet("global")]
        public async Task<IActionResult> GlobalSearch([FromQuery] string? query, [FromQuery] int maxResults = 10)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                {
                    return Ok(new ServiceResponse<SearchResultDto>
                    {
                        Success = true,
                        Message = "Empty query",
                        Data = new SearchResultDto()
                    });
                }

                var response = await _searchService.GlobalSearch(query, maxResults);

                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Error performing search", Error = ex.Message });
            }
        }
    }
}

