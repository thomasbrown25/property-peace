using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Dtos.OrganizationInvite;
using brownstone_hub_api.Dtos.OrganizationMember;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.OrganizationInviteService;
using brownstone_hub_api.Services.OrganizationMemberService;
using brownstone_hub_api.Services.OrganizationService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrganizationController : ControllerBase
    {
        private readonly IOrganizationService _organizationService;
        private readonly IOrganizationMemberService _memberService;
        private readonly IOrganizationInviteService _inviteService;
        private readonly IUserRepository _userRepository;
        private readonly ILogger<OrganizationController> _logger;

        public OrganizationController(
            IOrganizationService organizationService,
            IOrganizationMemberService memberService,
            IOrganizationInviteService inviteService,
            IUserRepository userRepository,
            ILogger<OrganizationController> logger)
        {
            _organizationService = organizationService;
            _memberService = memberService;
            _inviteService = inviteService;
            _userRepository = userRepository;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> CreateOrganization([FromBody] CreateOrganizationDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.CreateOrganizationAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("{organizationId}")]
        public async Task<IActionResult> GetOrganizationById(long organizationId)
        {
            var response = await _organizationService.GetOrganizationByIdAsync(organizationId);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("current")]
        public async Task<IActionResult> GetCurrentOrganization()
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.GetCurrentUserOrganizationAsync(userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("user/list")]
        public async Task<IActionResult> GetUserOrganizations()
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.GetUserOrganizationsAsync(userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPut]
        public async Task<IActionResult> UpdateOrganization([FromBody] UpdateOrganizationDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.UpdateOrganizationAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPatch("agent-settings")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> UpdateAgentSettings([FromBody] UpdateAgentSettingsDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
                return Unauthorized(new { Message = "User not authenticated" });

            var response = await _organizationService.UpdateAgentSettingsAsync(dto, userId.Value);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpDelete("{organizationId}")]
        public async Task<IActionResult> DeleteOrganization(long organizationId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.DeleteOrganizationAsync(organizationId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPost("switch")]
        public async Task<IActionResult> SwitchOrganization([FromBody] SwitchOrganizationDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _organizationService.SwitchOrganizationAsync(dto.OrganizationId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        // Member endpoints
        [HttpPost("members")]
        public async Task<IActionResult> AddMember([FromBody] AddOrganizationMemberDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _memberService.AddMemberAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("members/{organizationId}")]
        public async Task<IActionResult> GetMembers(long organizationId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _memberService.GetMembersByOrganizationIdAsync(organizationId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPut("members")]
        public async Task<IActionResult> UpdateMember([FromBody] UpdateOrganizationMemberDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _memberService.UpdateMemberAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpDelete("members/{organizationId}/{memberUserId}")]
        public async Task<IActionResult> RemoveMember(long organizationId, long memberUserId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _memberService.RemoveMemberAsync(organizationId, memberUserId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        // Invite endpoints
        [HttpPost("invites")]
        public async Task<IActionResult> CreateInvite([FromBody] CreateOrganizationInviteDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _inviteService.CreateInviteAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("invites/{organizationId}")]
        public async Task<IActionResult> GetInvites(long organizationId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _inviteService.GetInvitesByOrganizationIdAsync(organizationId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("invites/token/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetInviteByToken(string token)
        {
            var response = await _inviteService.GetInviteByTokenAsync(token);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPost("invites/accept")]
        public async Task<IActionResult> AcceptInvite([FromBody] AcceptOrganizationInviteDto dto)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _inviteService.AcceptInviteAsync(dto, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpDelete("invites/{inviteId}")]
        public async Task<IActionResult> DeleteInvite(long inviteId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _inviteService.DeleteInviteAsync(inviteId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpPost("invites/{inviteId}/resend")]
        public async Task<IActionResult> ResendInvite(long inviteId)
        {
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User not authenticated" });
            }

            var response = await _inviteService.ResendInviteAsync(inviteId, userId.Value);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }

            return Ok(response);
        }
    }
}

