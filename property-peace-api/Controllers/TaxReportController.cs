using brownstone_hub_api.Services.TaxReportService;
using brownstone_hub_api.Services.ScheduleEPdfService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TaxReportController(ITaxReportService taxReportService, IScheduleEPdfService scheduleEPdfService) : ControllerBase
    {
        private readonly ITaxReportService _taxReportService = taxReportService;
        private readonly IScheduleEPdfService _scheduleEPdfService = scheduleEPdfService;

        [HttpGet("year-report")]
        public async Task<IActionResult> GetTaxYearReport(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var response = await _taxReportService.GetTaxYearReport(landlordId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("category-summary")]
        public async Task<IActionResult> GetTaxCategorySummary(
            [FromQuery] long landlordId,
            [FromQuery] int? year = null)
        {
            var response = await _taxReportService.GetTaxCategorySummary(landlordId, year);
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
            var response = await _taxReportService.GetTaxDeductibleExpenses(landlordId, year, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("form1099")]
        public async Task<IActionResult> GetForm1099Data(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var response = await _taxReportService.GetForm1099Data(landlordId, year);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("readiness")]
        public async Task<IActionResult> GetTaxReadiness(
            [FromQuery] long landlordId,
            [FromQuery] int year)
        {
            var response = await _taxReportService.GetTaxReadiness(landlordId, year);
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
            var response = await _taxReportService.ExportToAccountingSoftware(landlordId, format, year, startDate, endDate);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            // Return file download
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
            var response = await _scheduleEPdfService.GenerateScheduleEPdfAsync(landlordId, year, perProperty);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            // Return PDF file download
            var fileName = $"schedule-e-{year}{(perProperty ? "-per-property" : "")}-{DateTime.Now:yyyyMMdd}.pdf";
            return File(
                response.Data!,
                "application/pdf",
                fileName);
        }
    }
}

