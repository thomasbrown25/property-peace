using brownstone_hub_api.Dtos.LeaseTemplate;
using brownstone_hub_api.Services.LeaseTemplateService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class LeaseTemplateController : ControllerBase
    {
        private readonly ILeaseTemplateService _leaseTemplateService;
        private readonly ILogger<LeaseTemplateController> _logger;

        public LeaseTemplateController(
            ILeaseTemplateService leaseTemplateService,
            ILogger<LeaseTemplateController> logger)
        {
            _leaseTemplateService = leaseTemplateService;
            _logger = logger;
        }

        [HttpGet("default")]
        public async Task<IActionResult> GetDefaultTemplate()
        {
            var response = await _leaseTemplateService.GetDefaultTemplateAsync();
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetTemplates()
        {
            var response = await _leaseTemplateService.GetTemplatesByOrganizationAsync();
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTemplate(long id)
        {
            var response = await _leaseTemplateService.GetTemplateByIdAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTemplate([FromBody] CreateLeaseTemplateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var response = await _leaseTemplateService.CreateTemplateAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return CreatedAtAction(nameof(GetTemplate), new { id = response.Data?.Id }, response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTemplate(long id, [FromBody] UpdateLeaseTemplateDto dto)
        {
            if (id != dto.Id)
                return BadRequest(new { Message = "ID mismatch" });

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var response = await _leaseTemplateService.UpdateTemplateAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(long id)
        {
            var response = await _leaseTemplateService.DeleteTemplateAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("{id}/set-default")]
        public async Task<IActionResult> SetDefaultTemplate(long id)
        {
            var response = await _leaseTemplateService.SetDefaultTemplateAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("ensure-default")]
        public async Task<IActionResult> EnsureDefaultTemplate()
        {
            var response = await _leaseTemplateService.EnsureDefaultTemplateExistsAsync();
            
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
