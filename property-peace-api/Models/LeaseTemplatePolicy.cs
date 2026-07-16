namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Individual policy item within a lease template
    /// </summary>
    public class LeaseTemplatePolicy
    {
        public long Id { get; set; }
        public long LeaseTemplateId { get; set; }
        public LeaseTemplate LeaseTemplate { get; set; } = null!;
        
        public string Title { get; set; } = string.Empty; // e.g., "Quiet Hours", "Parking"
        public string Content { get; set; } = string.Empty; // Policy text
        
        public string Category { get; set; } = string.Empty; // QuietHours, Parking, Trash, Guests, Smoking, Pets, etc.
        public int Order { get; set; } // Order within template
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
