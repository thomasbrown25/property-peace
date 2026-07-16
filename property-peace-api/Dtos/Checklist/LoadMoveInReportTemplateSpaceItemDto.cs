namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadMoveInReportTemplateSpaceItemDto
    {
        public long Id { get; set; }
        public string ItemName { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
}
