namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Organization-level move-in condition report template (name + spaces + items).
    /// One active template per organization.
    /// </summary>
    public class OrganizationMoveInReportTemplate
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;

        public string Name { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }

        public ICollection<OrganizationReportSpace> Spaces { get; set; } = [];
    }
}
