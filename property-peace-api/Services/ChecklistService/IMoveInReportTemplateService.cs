using brownstone_hub_api.Dtos.Checklist;

namespace brownstone_hub_api.Services.ChecklistService
{
    public interface IMoveInReportTemplateService
    {
        Task<ServiceResponse<LoadMoveInReportTemplateDto?>> GetMoveInReportTemplate();
        Task<ServiceResponse<LoadMoveInReportTemplateDto>> AddOrUpdateMoveInReportTemplate(AddOrUpdateMoveInReportTemplateDto dto);
    }
}
