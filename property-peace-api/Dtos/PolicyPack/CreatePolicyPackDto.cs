namespace brownstone_hub_api.Dtos.PolicyPack
{
    public class CreatePolicyPackDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<CreatePolicyPackItemDto> Items { get; set; } = [];
    }

    public class CreatePolicyPackItemDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
