using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Services.StaffMemberService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/staff-member")]
    [Authorize(Roles = "Landlord,Admin")]
    public class StaffMemberController(IStaffMemberService staffMemberService) : ControllerBase
    {
        private readonly IStaffMemberService _staffMemberService = staffMemberService;

        [HttpGet]
        public async Task<IActionResult> GetStaffMembers()
        {
            var response = await _staffMemberService.GetStaffMembers();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetStaffMemberById(long id)
        {
            var response = await _staffMemberService.GetStaffMemberById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetStaffMemberByUserId(long userId)
        {
            var response = await _staffMemberService.GetStaffMemberByUserId(userId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> AddStaffMember([FromBody] AddStaffMemberDto dto)
        {
            var response = await _staffMemberService.AddStaffMember(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateStaffMember(long id, [FromBody] UpdateStaffMemberDto dto)
        {
            dto.Id = id;
            var response = await _staffMemberService.UpdateStaffMember(id, dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteStaffMember(long id)
        {
            var response = await _staffMemberService.DeleteStaffMember(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
