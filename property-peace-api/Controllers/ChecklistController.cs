using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Services.LeaseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ChecklistController(
        IChecklistService checklistService,
        IOrganizationChecklistItemService organizationChecklistItemService,
        IMoveInReportTemplateService moveInReportTemplateService,
        ILeaseService leaseService) : ControllerBase
    {
        private readonly IChecklistService _checklistService = checklistService;
        private readonly IOrganizationChecklistItemService _organizationChecklistItemService = organizationChecklistItemService;
        private readonly IMoveInReportTemplateService _moveInReportTemplateService = moveInReportTemplateService;
        private readonly ILeaseService _leaseService = leaseService;

        [HttpGet("move-in-report-template")]
        public async Task<IActionResult> GetMoveInReportTemplate()
        {
            var response = await _moveInReportTemplateService.GetMoveInReportTemplate();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("move-in-report-template")]
        public async Task<IActionResult> AddOrUpdateMoveInReportTemplate([FromBody] AddOrUpdateMoveInReportTemplateDto dto)
        {
            var response = await _moveInReportTemplateService.AddOrUpdateMoveInReportTemplate(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("move-in-report-template/complete-for-lease/{leaseId}")]
        public async Task<IActionResult> CompleteMoveInReportTemplateForLease(long leaseId)
        {
            var response = await _leaseService.SetMoveInReportTemplateCompletedAt(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost]
        public async Task<IActionResult> AddChecklist([FromBody] AddChecklistDto checklist)
        {
            var response = await _checklistService.AddChecklist(checklist);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetChecklist(long id)
        {
            var response = await _checklistService.GetChecklistById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("landlord/{landlordId}")]
        public async Task<IActionResult> GetChecklistsByLandlord(long landlordId)
        {
            var response = await _checklistService.GetChecklistsByLandlordId(landlordId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetChecklistsByProperty(long propertyId)
        {
            var response = await _checklistService.GetChecklistsByPropertyId(propertyId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("unit/{unitId}")]
        public async Task<IActionResult> GetChecklistsByUnit(long unitId)
        {
            var response = await _checklistService.GetChecklistsByUnitId(unitId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("lease/{leaseId}")]
        public async Task<IActionResult> GetChecklistsByLease(long leaseId)
        {
            var response = await _checklistService.GetChecklistsByLeaseId(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("type/{checklistType}")]
        public async Task<IActionResult> GetChecklistsByType(ETenantDocumentType checklistType)
        {
            var response = await _checklistService.GetChecklistsByType(checklistType);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateChecklist(long id, [FromBody] UpdateChecklistDto checklist)
        {
            if (id != checklist.Id)
                return BadRequest(new { Message = "Checklist ID mismatch" });

            var response = await _checklistService.UpdateChecklist(checklist);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteChecklist(long id)
        {
            var response = await _checklistService.DeleteChecklist(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Organization Checklist Items endpoints
        [HttpPost("organization-items")]
        public async Task<IActionResult> AddOrganizationChecklistItem([FromBody] AddOrganizationChecklistItemDto item)
        {
            var response = await _organizationChecklistItemService.AddOrganizationChecklistItem(item);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("organization-items")]
        public async Task<IActionResult> GetOrganizationChecklistItems()
        {
            var response = await _organizationChecklistItemService.GetOrganizationChecklistItems();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("organization-items/{id}")]
        public async Task<IActionResult> GetOrganizationChecklistItem(long id)
        {
            var response = await _organizationChecklistItemService.GetOrganizationChecklistItemById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("organization-items/{id}")]
        public async Task<IActionResult> UpdateOrganizationChecklistItem(long id, [FromBody] UpdateOrganizationChecklistItemDto item)
        {
            if (id != item.Id)
                return BadRequest(new { Message = "Checklist item ID mismatch" });

            var response = await _organizationChecklistItemService.UpdateOrganizationChecklistItem(item);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("organization-items/{id}")]
        public async Task<IActionResult> DeleteOrganizationChecklistItem(long id)
        {
            var response = await _organizationChecklistItemService.DeleteOrganizationChecklistItem(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("organization-items/seed-defaults")]
        public async Task<IActionResult> SeedDefaultChecklistItems()
        {
            var response = await _organizationChecklistItemService.SeedDefaultChecklistItems();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{checklistId}/upload-images")]
        public async Task<IActionResult> UploadChecklistImages(long checklistId, [FromForm] List<IFormFile> files, [FromForm] bool isBeforeMoveIn = true)
        {
            if (files == null || files.Count == 0)
                return BadRequest(new { Message = "No files provided" });

            var response = await _checklistService.UploadChecklistImages(checklistId, files, isBeforeMoveIn);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{checklistId}/images/{blobName}")]
        public async Task<IActionResult> DeleteChecklistImage(long checklistId, string blobName, [FromQuery] bool isBeforeMoveIn = true)
        {
            if (string.IsNullOrEmpty(blobName))
                return BadRequest(new { Message = "Blob name is required" });

            var response = await _checklistService.DeleteChecklistImage(checklistId, blobName, isBeforeMoveIn);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{checklistId}/items/{itemId}/upload-image")]
        public async Task<IActionResult> UploadChecklistItemImage(long checklistId, long itemId, [FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "No file provided" });

            var response = await _checklistService.UploadChecklistItemImage(checklistId, itemId, file);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{checklistId}/items/{itemId}/images/{blobName}")]
        public async Task<IActionResult> DeleteChecklistItemImage(long checklistId, long itemId, string blobName)
        {
            if (string.IsNullOrEmpty(blobName))
                return BadRequest(new { Message = "Blob name is required" });

            var response = await _checklistService.DeleteChecklistItemImage(checklistId, itemId, blobName);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

