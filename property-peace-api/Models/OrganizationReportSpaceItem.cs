namespace brownstone_hub_api.Models
{
    /// <summary>
    /// An item within a space in the move-in report template (e.g. "Sink and Plumbing" in Bathroom).
    /// </summary>
    public class OrganizationReportSpaceItem
    {
        public long Id { get; set; }
        public long SpaceId { get; set; }
        public OrganizationReportSpace Space { get; set; } = null!;

        public string ItemName { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
}
