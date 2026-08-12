using brownstone_hub_api.Helpers;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Services.ExpenseReportService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    [AdvancedReportingEntitlement]
    public class ExpenseReportController(IExpenseReportService expenseReportService) : ControllerBase
    {
        private readonly IExpenseReportService _expenseReportService = expenseReportService;

        [HttpGet("report")]
        public async Task<IActionResult> GetExpenseReport(
            [FromQuery] long? propertyId = null,
            [FromQuery] long? unitId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? category = null,
            [FromQuery] long? vendorId = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetExpenseReport(organizationId.Value, propertyId, unitId, startDate, endDate, category, vendorId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetExpenseReportSummary(
            [FromQuery] long? propertyId = null,
            [FromQuery] long? unitId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? category = null,
            [FromQuery] long? vendorId = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetExpenseReportSummary(organizationId.Value, propertyId, unitId, startDate, endDate, category, vendorId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("trends")]
        public async Task<IActionResult> GetExpenseTrends(
            [FromQuery] long? propertyId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string groupBy = "month")
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetExpenseTrends(organizationId.Value, propertyId, startDate, endDate, groupBy);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("by-category")]
        public async Task<IActionResult> GetExpenseReportByCategory(
            [FromQuery] long? propertyId = null,
            [FromQuery] long? unitId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetExpenseReportByCategory(organizationId.Value, propertyId, unitId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("profitability")]
        public async Task<IActionResult> GetPropertyProfitability(
            [FromQuery] long? propertyId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetPropertyProfitability(organizationId.Value, propertyId, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("year-over-year")]
        public async Task<IActionResult> GetYearOverYearComparison(
            [FromQuery] long? propertyId = null,
            [FromQuery] int? year1 = null,
            [FromQuery] int? year2 = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetYearOverYearComparison(organizationId.Value, propertyId, year1, year2);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("income-by-year")]
        public async Task<IActionResult> GetIncomeByYear(
            [FromQuery] long? propertyId = null,
            [FromQuery] int? year1 = null,
            [FromQuery] int? year2 = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _expenseReportService.GetIncomeByYear(organizationId.Value, propertyId, year1, year2);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

