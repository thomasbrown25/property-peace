using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.TimeEntryService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/time-entry")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TimeEntryController(ITimeEntryService timeEntryService) : ControllerBase
    {
        private readonly ITimeEntryService _timeEntryService = timeEntryService;

        [HttpPost("start")]
        public async Task<IActionResult> StartTimer([FromBody] StartTimerDto dto)
        {
            var response = await _timeEntryService.StartTimer(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{id}/stop")]
        public async Task<IActionResult> StopTimer(long id, [FromBody] StopTimerDto dto)
        {
            var response = await _timeEntryService.StopTimer(id, dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTimeEntry([FromBody] AddTimeEntryDto dto)
        {
            var response = await _timeEntryService.CreateTimeEntry(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTimeEntry(long id, [FromBody] UpdateTimeEntryDto dto)
        {
            dto.Id = id;
            var response = await _timeEntryService.UpdateTimeEntry(id, dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTimeEntry(long id)
        {
            var response = await _timeEntryService.DeleteTimeEntry(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTimeEntryById(long id)
        {
            var response = await _timeEntryService.GetTimeEntryById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetTimeEntries(
            [FromQuery] long? propertyId = null,
            [FromQuery] long? staffMemberId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] ETimeEntryStatus? status = null)
        {
            var response = await _timeEntryService.GetTimeEntries(propertyId, staffMemberId, startDate, endDate, status);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetTimeEntriesByProperty(long propertyId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            var response = await _timeEntryService.GetTimeEntriesByProperty(propertyId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("staff/{staffMemberId}")]
        public async Task<IActionResult> GetTimeEntriesByStaffMember(long staffMemberId, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            var response = await _timeEntryService.GetTimeEntriesByStaffMember(staffMemberId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("maintenance/{maintenanceRequestId}")]
        public async Task<IActionResult> GetTimeEntriesByMaintenanceRequest(long maintenanceRequestId)
        {
            var response = await _timeEntryService.GetTimeEntriesByMaintenanceRequest(maintenanceRequestId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("pending-approvals")]
        public async Task<IActionResult> GetPendingApprovals()
        {
            var response = await _timeEntryService.GetPendingApprovals();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{id}/submit")]
        public async Task<IActionResult> SubmitForApproval(long id, [FromBody] SubmitTimeEntryDto dto)
        {
            var response = await _timeEntryService.SubmitForApproval(id, dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{id}/approve")]
        public async Task<IActionResult> ApproveTimeEntry(long id, [FromBody] ApproveTimeEntryDto dto)
        {
            if (dto.IsApproved)
            {
                var response = await _timeEntryService.ApproveTimeEntry(id, dto);
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                return Ok(response);
            }
            else
            {
                var response = await _timeEntryService.RejectTimeEntry(id, dto);
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                return Ok(response);
            }
        }
    }
}
