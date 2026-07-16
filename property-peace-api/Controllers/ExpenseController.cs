using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.ExpenseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ExpenseController(IExpenseService expenseService) : ControllerBase
    {
        private readonly IExpenseService _expenseService = expenseService;

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> AddExpense([FromBody] AddExpenseDto expense)
        {
            var response = await _expenseService.AddExpense(expense);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateExpense(long id, [FromBody] UpdateExpenseDto expense)
        {
            if (id != expense.Id)
                return BadRequest(new { Message = "Expense ID mismatch" });

            var response = await _expenseService.UpdateExpense(expense);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteExpense(long id)
        {
            var response = await _expenseService.DeleteExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetExpenseById(long id)
        {
            var response = await _expenseService.GetExpenseById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetExpenses(
            [FromQuery] long? propertyId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? category = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseService.GetExpenses(organizationId.Value, propertyId, startDate, endDate, category);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet("total")]
        public async Task<IActionResult> GetTotalExpenses(
            [FromQuery] long? propertyId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseService.GetTotalExpenses(organizationId.Value, propertyId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPost("{id}/pause")]
        public async Task<IActionResult> PauseRecurringExpense(long id)
        {
            var response = await _expenseService.PauseRecurringExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet("unpaid-bills")]
        public async Task<IActionResult> GetUnpaidBills([FromQuery] string? filter = null)
        {
            var response = await _expenseService.GetUnpaidBillsAsync(filter);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPost("{id}/mark-paid")]
        public async Task<IActionResult> MarkBillAsPaid(long id, [FromBody] DateTime? paidDate = null)
        {
            var dateToUse = paidDate ?? DateTime.Now;
            var response = await _expenseService.MarkBillAsPaidAsync(id, dateToUse);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> ResumeRecurringExpense(long id)
        {
            var response = await _expenseService.ResumeRecurringExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

