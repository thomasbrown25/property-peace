namespace brownstone_hub_api.Dtos.PolicyPack
{
    public class UpdatePolicyPackDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<UpdatePolicyPackItemDto> Items { get; set; } = [];
    }

    public class UpdatePolicyPackItemDto
    {
        public long? Id { get; set; } // Null for new items
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
