namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadChecklistItemDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? Condition { get; set; }
        public string? Notes { get; set; }
        public bool HasDamage { get; set; } = false;
        public string? DamageDescription { get; set; }
        public List<string>? PhotoBlobNames { get; set; }
        public List<string>? PhotoBlobUrls { get; set; }
        public bool IsChecked { get; set; } = false;
        public DateTime? CheckedAt { get; set; }
        public int SortOrder { get; set; } = 0;
    }
}

