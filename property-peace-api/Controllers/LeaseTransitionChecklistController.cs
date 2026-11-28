using brownstone_hub_api.Dtos.LeaseTransitionChecklist;
using brownstone_hub_api.Services.LeaseTransitionChecklistService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/lease-transition-checklists")]
    [Authorize(Roles = "Landlord,Admin")]
    public class LeaseTransitionChecklistController(ILeaseTransitionChecklistService service) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] long? propertyId, [FromQuery] long? unitId, [FromQuery] long? leaseId) => ToResult(await service.List(propertyId, unitId, leaseId));
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateLeaseTransitionChecklistDto dto) => ToResult(await service.Create(dto), 201);
        [HttpGet("{id:long}")]
        public async Task<IActionResult> Get(long id) => ToResult(await service.Get(id));
        [HttpPut("{id:long}/items/{key}")]
        public async Task<IActionResult> UpdateItem(long id, string key, [FromBody] UpdateLeaseTransitionChecklistItemDto dto) => ToResult(await service.UpdateItem(id, key, dto));
        [HttpPut("{id:long}/condition-report")]
        public async Task<IActionResult> LinkConditionReport(long id, [FromBody] LinkConditionReportDto dto) => ToResult(await service.LinkConditionReport(id, dto));
        [HttpDelete("{id:long}/condition-report")]
        public async Task<IActionResult> DetachConditionReport(long id) => ToResult(await service.DetachConditionReport(id));

        private IActionResult ToResult<T>(ServiceResponse<T> response, int successStatus = 200) => response.Success ? StatusCode(successStatus, response) : StatusCode(response.StatusCode, new { response.Message, response.Errors });
    }
}
