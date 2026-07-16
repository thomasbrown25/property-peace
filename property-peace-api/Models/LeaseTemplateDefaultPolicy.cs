namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Default policies that are used when creating a new organization's lease template
    /// </summary>
    public class LeaseTemplateDefaultPolicy
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
