using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.KPIReportService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class KPIReportController(IKPIReportService kpiReportService) : ControllerBase
    {
        private readonly IKPIReportService _kpiReportService = kpiReportService;

        [HttpGet("occupancy")]
        public async Task<IActionResult> GetOccupancyReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] string? unitIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;
            var unitIdList = !string.IsNullOrEmpty(unitIds) 
                ? unitIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetOccupancyReport(
                organizationId.Value, propertyIdList, unitIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("revenue-per-unit")]
        public async Task<IActionResult> GetRevenuePerUnitReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] string? unitIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;
            var unitIdList = !string.IsNullOrEmpty(unitIds) 
                ? unitIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetRevenuePerUnitReport(
                organizationId.Value, propertyIdList, unitIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("units-per-client")]
        public async Task<IActionResult> GetUnitsPerClientReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetUnitsPerClientReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("client-churn")]
        public async Task<IActionResult> GetClientChurnReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetClientChurnReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("units-per-employee")]
        public async Task<IActionResult> GetUnitsPerEmployeeReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetUnitsPerEmployeeReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("closing-rate")]
        public async Task<IActionResult> GetClosingRateReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetClosingRateReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("median-dom")]
        public async Task<IActionResult> GetMedianDOMReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] string? unitIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;
            var unitIdList = !string.IsNullOrEmpty(unitIds) 
                ? unitIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetMedianDOMReport(
                organizationId.Value, propertyIdList, unitIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("median-ttt")]
        public async Task<IActionResult> GetMedianTTTReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] string? unitIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;
            var unitIdList = !string.IsNullOrEmpty(unitIds) 
                ? unitIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetMedianTTTReport(
                organizationId.Value, propertyIdList, unitIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("nps-client")]
        public async Task<IActionResult> GetNPSClientReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetNPSClientReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("nps-tenant")]
        public async Task<IActionResult> GetNPSTenantReport(
            [FromQuery] string? propertyIds = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? timeRange = null)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var propertyIdList = !string.IsNullOrEmpty(propertyIds) 
                ? propertyIds.Split(',').Select(long.Parse).ToList() 
                : null;

            var response = await _kpiReportService.GetNPSTenantReport(
                organizationId.Value, propertyIdList, startDate, endDate, timeRange);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
