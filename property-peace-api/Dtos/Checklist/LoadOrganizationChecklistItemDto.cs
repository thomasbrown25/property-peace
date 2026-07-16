namespace brownstone_hub_api.Dtos.Checklist
{
    public class LoadOrganizationChecklistItemDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public bool IsDefault { get; set; } = false;
        public int SortOrder { get; set; } = 0;
        public long OrganizationId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

