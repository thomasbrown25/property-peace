namespace brownstone_hub_api.Dtos.LeaseTemplate
{
    public class LoadLeaseTemplateDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? State { get; set; }
        public string? PropertyType { get; set; }
        public string TemplateStructure { get; set; } = "{}";
        public bool IsDefault { get; set; }
        public bool IsDefaultForLandlord { get; set; }
        public string Version { get; set; } = "1.0";
        public long? OrganizationId { get; set; }
        public long? LandlordId { get; set; }
        public List<LoadLeaseTemplatePolicyDto> Policies { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class LoadLeaseTemplatePolicyDto
    {
        public long Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
