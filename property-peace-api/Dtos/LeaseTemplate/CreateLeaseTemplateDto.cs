namespace brownstone_hub_api.Dtos.LeaseTemplate
{
    public class CreateLeaseTemplateDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? State { get; set; }
        public string? PropertyType { get; set; } // SFH, MFH, Any
        public string TemplateStructure { get; set; } = "{}"; // JSON structure
        public bool IsDefaultForLandlord { get; set; } = false;
        public long? SourceTemplateId { get; set; } // If copying from existing template
        public List<CreateLeaseTemplatePolicyDto> Policies { get; set; } = [];
    }

    public class CreateLeaseTemplatePolicyDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
