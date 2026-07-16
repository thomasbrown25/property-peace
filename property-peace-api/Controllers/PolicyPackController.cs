using brownstone_hub_api.Dtos.PolicyPack;
using brownstone_hub_api.Services.PolicyPackService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class PolicyPackController : ControllerBase
    {
        private readonly IPolicyPackService _policyPackService;
        private readonly ILogger<PolicyPackController> _logger;

        public PolicyPackController(
            IPolicyPackService policyPackService,
            ILogger<PolicyPackController> logger)
        {
            _policyPackService = policyPackService;
            _logger = logger;
        }

        [HttpGet("default")]
        public async Task<IActionResult> GetDefaultPolicyPack()
        {
            var response = await _policyPackService.GetDefaultPolicyPackAsync();
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetPolicyPacks()
        {
            var response = await _policyPackService.GetPolicyPacksByOrganizationAsync();
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPolicyPack(long id)
        {
            var response = await _policyPackService.GetPolicyPackByIdAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("{id}/items")]
        public async Task<IActionResult> GetPolicyPackItems(long id)
        {
            var response = await _policyPackService.GetPolicyPackByIdAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(new { Items = response.Data?.Items });
        }

        [HttpPost]
        public async Task<IActionResult> CreatePolicyPack([FromBody] CreatePolicyPackDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var response = await _policyPackService.CreatePolicyPackAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return CreatedAtAction(nameof(GetPolicyPack), new { id = response.Data?.Id }, response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePolicyPack(long id, [FromBody] UpdatePolicyPackDto dto)
        {
            if (id != dto.Id)
                return BadRequest(new { Message = "ID mismatch" });

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var response = await _policyPackService.UpdatePolicyPackAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePolicyPack(long id)
        {
            var response = await _policyPackService.DeletePolicyPackAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }
    }
}
