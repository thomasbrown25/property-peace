namespace brownstone_hub_api.Models
{
    /// <summary>
    /// A space (room type) in the move-in report template, with quantity (e.g. Bedroom x4).
    /// </summary>
    public class OrganizationReportSpace
    {
        public long Id { get; set; }
        public long TemplateId { get; set; }
        public OrganizationMoveInReportTemplate Template { get; set; } = null!;

        /// <summary>e.g. "Living Room", "Kitchen", "Bedroom", "Bathroom", "Dining Room", "Mechanical Systems", "Other", or custom</summary>
        public string SpaceLabel { get; set; } = string.Empty;
        /// <summary>Custom name when SpaceLabel is "Other" or for user-added rooms</summary>
        public string? CustomName { get; set; }
        public int Quantity { get; set; } = 1;
        public int SortOrder { get; set; }

        public ICollection<OrganizationReportSpaceItem> Items { get; set; } = [];
    }
}
