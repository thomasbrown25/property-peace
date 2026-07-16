namespace brownstone_hub_api.Models
{
    /// <summary>Organization-specific custom features. Shown when creating a listing in that org.</summary>
    public class CustomFeature
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public long OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;
        public long CreatedBy { get; set; }
        public User CreatedByUser { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
