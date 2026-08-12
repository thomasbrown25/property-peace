using brownstone_hub_api.Attributes;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Services.TaxReportService;
using brownstone_hub_api.Services.ScheduleEPdfService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    [RequireOrganizationRole("Owner", "Manager")]
    [AdvancedReportingEntitlement]
    public class TaxReportController(ITaxReportService taxReportService, IScheduleEPdfService scheduleEPdfService, IUserService userService) : ControllerBase
    {
        private readonly ITaxReportService _taxReportService = taxReportService;
        private readonly IScheduleEPdfService _scheduleEPdfService = scheduleEPdfService;
        private readonly IUserService _userService = userService;

        [HttpGet("year-report")]
        public async Task<IActionResult> GetTaxYearReport(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.GetTaxYearReport(scope.Value.OrganizationId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("category-summary")]
        public async Task<IActionResult> GetTaxCategorySummary(
            [FromQuery] long landlordId,
            [FromQuery] int? year = null)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.GetTaxCategorySummary(scope.Value.OrganizationId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("deductible-expenses")]
        public async Task<IActionResult> GetTaxDeductibleExpenses(
            [FromQuery] long landlordId,
            [FromQuery] int? year = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.GetTaxDeductibleExpenses(scope.Value.OrganizationId, year, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("form1099")]
        public async Task<IActionResult> GetForm1099Data(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.GetForm1099Data(scope.Value.OrganizationId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("readiness")]
        public async Task<IActionResult> GetTaxReadiness(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.GetTaxReadiness(scope.Value.OrganizationId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportToAccountingSoftware(
            [FromQuery] long landlordId,
            [FromQuery] string format,
            [FromQuery] int? year = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            var response = await _taxReportService.ExportToAccountingSoftware(scope.Value.OrganizationId, format, year, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            if (response.Data!.IsExperimentalTemplate)
            {
                Response.Headers["X-Import-Template-Status"] = "experimental";
                Response.Headers["X-Import-Disclaimer"] = response.Data.ImportDisclaimer;
            }

            return File(
                System.Text.Encoding.UTF8.GetBytes(response.Data!.FileContent),
                response.Data.MimeType,
                response.Data.FileName);
        }

        [HttpGet("schedule-e-pdf")]
        public async Task<IActionResult> GetScheduleEPdf(
            [FromQuery] long landlordId,
            [FromQuery] int year,
            [FromQuery] bool perProperty = false)
        {
            var scope = await ResolveScopeAsync();
            if (!scope.HasValue) return ScopeRequired();
            if (perProperty)
                return StatusCode(StatusCodes.Status422UnprocessableEntity, new { Message = "Per-property Schedule E is unsupported because verified property-level tax totals are not available. No PDF was generated." });

            var response = await _scheduleEPdfService.GenerateScheduleEPdfAsync(scope.Value.OrganizationId, scope.Value.UserId, year, false);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            // Return PDF file download
            var fileName = $"schedule-e-{year}{(perProperty ? "-per-property" : "")}-{DateTime.Now:yyyyMMdd}.pdf";
            return File(
                response.Data!,
                "application/pdf",
                fileName);
        }

        private async Task<(long OrganizationId, long UserId)?> ResolveScopeAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue || organizationId.Value <= 0) return null;
            var user = await _userService.GetCurrentUserIdAsync();
            if (!user.Success || !user.Data.HasValue || user.Data.Value <= 0) return null;
            return (organizationId.Value, user.Data.Value);
        }

        private IActionResult ScopeRequired() =>
            StatusCode(StatusCodes.Status403Forbidden, new { Message = "Active organization and authenticated user context are required" });
    }
}

