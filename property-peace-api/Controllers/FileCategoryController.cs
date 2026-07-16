using brownstone_hub_api.Services.FileCategoryService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class FileCategoryController(IFileCategoryService fileCategoryService) : ControllerBase
    {
        private readonly IFileCategoryService _fileCategoryService = fileCategoryService;

        [HttpPost]
        public async Task<IActionResult> AddFileCategory([FromBody] brownstone_hub_api.Dtos.FileCategory.AddFileCategoryDto category)
        {
            var response = await _fileCategoryService.AddFileCategory(category);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetFileCategory(long id)
        {
            var response = await _fileCategoryService.GetFileCategoryById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet]
        public async Task<IActionResult> GetFileCategories()
        {
            var response = await _fileCategoryService.GetFileCategories();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateFileCategory(long id, [FromBody] brownstone_hub_api.Dtos.FileCategory.UpdateFileCategoryDto category)
        {
            var response = await _fileCategoryService.UpdateFileCategory(id, category);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFileCategory(long id)
        {
            var response = await _fileCategoryService.DeleteFileCategory(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

