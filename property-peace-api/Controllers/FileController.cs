using brownstone_hub_api.Services.FileService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class FileController(IFileService fileService) : ControllerBase
    {
        private readonly IFileService _fileService = fileService;

        [HttpPost("upload")]
        public async Task<IActionResult> UploadFiles(
            [FromForm] List<IFormFile> files,
            [FromForm] string? title = null,
            [FromForm] long? categoryId = null,
            [FromForm] long? propertyId = null,
            [FromForm] long? unitId = null,
            [FromForm] long? leaseId = null)
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "No files provided" });
            }

            var response = await _fileService.AddFiles(files, title, categoryId, propertyId, unitId, leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetFile(long id)
        {
            var response = await _fileService.GetFileById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetFiles(
            [FromQuery] long? categoryId = null,
            [FromQuery] long? propertyId = null,
            [FromQuery] long? unitId = null,
            [FromQuery] long? leaseId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var response = await _fileService.GetFiles(categoryId, propertyId, unitId, leaseId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFile(long id, [FromBody] brownstone_hub_api.Dtos.File.UpdateFileDto file)
        {
            var response = await _fileService.UpdateFile(id, file);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFile(long id)
        {
            var response = await _fileService.DeleteFile(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

