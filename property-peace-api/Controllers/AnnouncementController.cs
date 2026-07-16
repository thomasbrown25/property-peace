using brownstone_hub_api.Dtos.Announcement;
using brownstone_hub_api.Services.AnnouncementService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AnnouncementController(IAnnouncementService announcementService) : ControllerBase
    {
        private readonly IAnnouncementService _announcementService = announcementService;

        [HttpPost("format")]
        public async Task<IActionResult> FormatMessage([FromBody] FormatMessageDto dto)
        {
            var response = await _announcementService.FormatMessageAsync(dto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendAnnouncement([FromBody] SendAnnouncementDto dto)
        {
            var response = await _announcementService.SendAnnouncementAsync(dto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetAnnouncements(
            [FromQuery] DateTime? fromDate, 
            [FromQuery] DateTime? toDate,
            [FromQuery] long? organizationId = null,
            [FromQuery] long? propertyId = null)
        {
            var response = await _announcementService.GetAnnouncementsAsync(fromDate, toDate, organizationId, propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetAnnouncementById(long id)
        {
            var response = await _announcementService.GetAnnouncementByIdAsync(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAnnouncement(long id)
        {
            var response = await _announcementService.DeleteAnnouncementAsync(id);

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
