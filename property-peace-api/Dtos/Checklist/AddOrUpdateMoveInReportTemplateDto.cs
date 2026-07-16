namespace brownstone_hub_api.Dtos.Checklist
{
    public class AddOrUpdateMoveInReportTemplateDto
    {
        public string Name { get; set; } = string.Empty;
        public List<MoveInReportTemplateSpaceDto> Spaces { get; set; } = [];
    }
}
