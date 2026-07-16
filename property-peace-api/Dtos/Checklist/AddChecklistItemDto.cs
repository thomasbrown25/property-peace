namespace brownstone_hub_api.Dtos.Checklist
{
    public class AddChecklistItemDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? Condition { get; set; }
        public string? Notes { get; set; }
        public bool HasDamage { get; set; } = false;
        public string? DamageDescription { get; set; }
        public string? PhotoBlobName { get; set; }
        public string? PhotoBlobUrl { get; set; }
        public int SortOrder { get; set; } = 0;
    }
}

