using brownstone_hub_api.Dtos.TimeBreak;
using brownstone_hub_api.Services.TimeBreakService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/time-break")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TimeBreakController(ITimeBreakService timeBreakService) : ControllerBase
    {
        private readonly ITimeBreakService _timeBreakService = timeBreakService;

        [HttpPost("time-entry/{timeEntryId}")]
        public async Task<IActionResult> AddTimeBreak(long timeEntryId, [FromBody] AddTimeBreakDto dto)
        {
            dto.TimeEntryId = timeEntryId;
            var response = await _timeBreakService.AddTimeBreak(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTimeBreak(long id, [FromBody] UpdateTimeBreakDto dto)
        {
            dto.Id = id;
            var response = await _timeBreakService.UpdateTimeBreak(id, dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTimeBreak(long id)
        {
            var response = await _timeBreakService.DeleteTimeBreak(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTimeBreakById(long id)
        {
            var response = await _timeBreakService.GetTimeBreakById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("time-entry/{timeEntryId}")]
        public async Task<IActionResult> GetTimeBreaksByTimeEntryId(long timeEntryId)
        {
            var response = await _timeBreakService.GetTimeBreaksByTimeEntryId(timeEntryId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
