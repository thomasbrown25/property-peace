namespace brownstone_hub_api.Dtos.PolicyPack
{
    public class LoadPolicyPackDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsDefault { get; set; }
        public long? OrganizationId { get; set; }
        public long? LandlordId { get; set; }
        public List<LoadPolicyPackItemDto> Items { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class LoadPolicyPackItemDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
