namespace brownstone_hub_api.Dtos.Checklist
{
    public class MoveInReportTemplateSpaceDto
    {
        public string SpaceLabel { get; set; } = string.Empty;
        public string? CustomName { get; set; }
        public int Quantity { get; set; } = 1;
        public int SortOrder { get; set; }
        public List<MoveInReportTemplateSpaceItemDto> Items { get; set; } = [];
    }
}
