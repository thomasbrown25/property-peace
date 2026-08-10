using brownstone_hub_api.Attributes;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Services.RecurringExpenseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    [RequireOrganizationRole("Owner", "Manager")]
    public class RecurringExpenseController(IRecurringExpenseService recurringExpenseService) : ControllerBase
    {
        private readonly IRecurringExpenseService _recurringExpenseService = recurringExpenseService;

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> AddRecurringExpense([FromBody] AddRecurringExpenseDto recurringExpense)
        {
            Console.WriteLine($"[RecurringExpenseController] AddRecurringExpense called with: LandlordId={recurringExpense.LandlordId}, PropertyId={recurringExpense.PropertyId}, Name={recurringExpense.Name}, Amount={recurringExpense.Amount}");
            var response = await _recurringExpenseService.AddRecurringExpense(recurringExpense);
            Console.WriteLine($"[RecurringExpenseController] AddRecurringExpense response: Success={response.Success}, StatusCode={response.StatusCode}, Message={response.Message}");
            if (!response.Success)
            {
                Console.WriteLine($"[RecurringExpenseController] AddRecurringExpense failed: {response.Message}");
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }
            Console.WriteLine($"[RecurringExpenseController] AddRecurringExpense succeeded, returning OK");
            return Ok(response);
        }

        [Authorize]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRecurringExpense(long id, [FromBody] UpdateRecurringExpenseDto recurringExpense)
        {
            if (id != recurringExpense.Id)
                return BadRequest(new { Message = "Recurring expense ID mismatch" });

            var response = await _recurringExpenseService.UpdateRecurringExpense(recurringExpense);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRecurringExpense(long id)
        {
            var response = await _recurringExpenseService.DeleteRecurringExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetRecurringExpenseById(long id)
        {
            var response = await _recurringExpenseService.GetRecurringExpenseById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetRecurringExpenses(
            [FromQuery] long? propertyId = null,
            [FromQuery] long? unitId = null)
        {
            var response = await _recurringExpenseService.GetRecurringExpenses(propertyId, unitId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPost("{id}/pause")]
        public async Task<IActionResult> PauseRecurringExpense(long id)
        {
            var response = await _recurringExpenseService.PauseRecurringExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> ResumeRecurringExpense(long id)
        {
            var response = await _recurringExpenseService.ResumeRecurringExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Internal endpoint for background service (could be protected with internal auth or API key)
        [HttpPost("generate")]
        public async Task<IActionResult> GenerateExpensesFromRecurringTemplates()
        {
            var response = await _recurringExpenseService.GenerateExpensesFromRecurringTemplates();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
