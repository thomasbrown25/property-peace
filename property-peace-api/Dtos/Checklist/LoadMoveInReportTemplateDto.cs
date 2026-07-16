namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadMoveInReportTemplateDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<LoadMoveInReportTemplateSpaceDto> Spaces { get; set; } = [];
    }
}
