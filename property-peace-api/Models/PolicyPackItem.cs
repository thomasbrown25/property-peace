namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Individual policy item within a policy pack
    /// </summary>
    public class PolicyPackItem
    {
        public long Id { get; set; }
        public long PolicyPackId { get; set; }
        public PolicyPack PolicyPack { get; set; } = null!;
        
        public string Title { get; set; } = string.Empty; // e.g., "Quiet Hours", "Parking"
        public string Content { get; set; } = string.Empty; // Policy text
        
        public string Category { get; set; } = string.Empty; // QuietHours, Parking, Trash, Guests, Smoking, Pets, etc.
        public int Order { get; set; } // Order within pack
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? UpdatedAt { get; set; }
    }
}
