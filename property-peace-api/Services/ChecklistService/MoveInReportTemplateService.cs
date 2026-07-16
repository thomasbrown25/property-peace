using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Repositories.Checklists;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.ChecklistService
{
    public class MoveInReportTemplateService(
        IMoveInReportTemplateRepository repository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<MoveInReportTemplateService> logger) : IMoveInReportTemplateService
    {
        private readonly IMoveInReportTemplateRepository _repository = repository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<MoveInReportTemplateService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadMoveInReportTemplateDto?>> GetMoveInReportTemplate()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadMoveInReportTemplateDto?>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var template = await _repository.GetByOrganizationId(organizationId.Value);
                return ServiceResponse<LoadMoveInReportTemplateDto?>.CreateSuccess(template, "Template retrieved", 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting move-in report template");
                return ServiceResponse<LoadMoveInReportTemplateDto?>.CreateError("An error occurred while retrieving the template", ex.Message, "", 500);
            }
        }

        public async Task<ServiceResponse<LoadMoveInReportTemplateDto>> AddOrUpdateMoveInReportTemplate(AddOrUpdateMoveInReportTemplateDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadMoveInReportTemplateDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return ServiceResponse<LoadMoveInReportTemplateDto>.CreateError("Report name is required", "Name cannot be empty", "", 400);
                }

                var result = await _repository.AddOrUpdate(organizationId.Value, dto);
                return ServiceResponse<LoadMoveInReportTemplateDto>.CreateSuccess(result, "Report template saved successfully", 200);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding/updating move-in report template");
                return ServiceResponse<LoadMoveInReportTemplateDto>.CreateError("An error occurred while saving the template", ex.Message, "", 500);
            }
        }
    }
}
