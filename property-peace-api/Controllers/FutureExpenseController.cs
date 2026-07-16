using brownstone_hub_api.Dtos.FutureExpense;
using brownstone_hub_api.Services.FutureExpenseService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class FutureExpenseController(IFutureExpenseService futureExpenseService) : ControllerBase
    {
        private readonly IFutureExpenseService _futureExpenseService = futureExpenseService;

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> AddFutureExpense([FromBody] AddFutureExpenseDto futureExpense)
        {
            Console.WriteLine($"[FutureExpenseController] AddFutureExpense called with: LandlordId={futureExpense.LandlordId}, PropertyId={futureExpense.PropertyId}, Name={futureExpense.Name}, Amount={futureExpense.Amount}, DueDate={futureExpense.DueDate}");
            var response = await _futureExpenseService.AddFutureExpense(futureExpense);
            Console.WriteLine($"[FutureExpenseController] AddFutureExpense response: Success={response.Success}, StatusCode={response.StatusCode}, Message={response.Message}");
            if (!response.Success)
            {
                Console.WriteLine($"[FutureExpenseController] AddFutureExpense failed: {response.Message}");
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            }
            Console.WriteLine($"[FutureExpenseController] AddFutureExpense succeeded, returning OK");
            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFutureExpense(long id)
        {
            var response = await _futureExpenseService.DeleteFutureExpense(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetFutureExpenseById(long id)
        {
            var response = await _futureExpenseService.GetFutureExpenseById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetFutureExpenses(
            [FromQuery] long landlordId,
            [FromQuery] long? propertyId = null)
        {
            var response = await _futureExpenseService.GetFutureExpenses(landlordId, propertyId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
