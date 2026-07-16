using brownstone_hub_api.Dtos.LandlordTask;
using brownstone_hub_api.Services.LandlordTaskService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/task")]
    [Authorize]
    public class TaskController(ILandlordTaskService taskService) : ControllerBase
    {
        private readonly ILandlordTaskService _taskService = taskService;

        [HttpGet]
        public async Task<IActionResult> GetTasks(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] long? propertyId)
        {
            var response = await _taskService.GetTasks(from, to, propertyId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTaskById(long id)
        {
            var response = await _taskService.GetTaskById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> AddTask([FromBody] AddLandlordTaskDto dto)
        {
            var response = await _taskService.AddTask(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return StatusCode(201, response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(long id, [FromBody] UpdateLandlordTaskDto dto)
        {
            if (id != dto.Id)
                return BadRequest(new { Message = "ID mismatch" });

            var response = await _taskService.UpdateTask(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(long id)
        {
            var response = await _taskService.DeleteTask(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
