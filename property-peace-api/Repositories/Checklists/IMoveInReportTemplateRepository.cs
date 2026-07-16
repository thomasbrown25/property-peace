using brownstone_hub_api.Dtos.Checklist;

namespace brownstone_hub_api.Repositories.Checklists
{
    public interface IMoveInReportTemplateRepository
    {
        Task<LoadMoveInReportTemplateDto?> GetByOrganizationId(long organizationId);
        Task<LoadMoveInReportTemplateDto> AddOrUpdate(long organizationId, AddOrUpdateMoveInReportTemplateDto dto);
    }
}
