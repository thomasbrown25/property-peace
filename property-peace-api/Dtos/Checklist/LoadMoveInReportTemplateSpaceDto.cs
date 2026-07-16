namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadMoveInReportTemplateSpaceDto
    {
        public long Id { get; set; }
        public string SpaceLabel { get; set; } = string.Empty;
        public string? CustomName { get; set; }
        public int Quantity { get; set; }
        public int SortOrder { get; set; }
        public List<LoadMoveInReportTemplateSpaceItemDto> Items { get; set; } = [];
    }
}
