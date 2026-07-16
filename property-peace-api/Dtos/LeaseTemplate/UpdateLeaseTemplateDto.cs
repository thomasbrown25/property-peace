namespace brownstone_hub_api.Dtos.LeaseTemplate
{
    public class UpdateLeaseTemplateDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? State { get; set; }
        public string? PropertyType { get; set; }
        public string TemplateStructure { get; set; } = "{}";
        public bool IsDefaultForLandlord { get; set; } = false;
        public List<UpdateLeaseTemplatePolicyDto> Policies { get; set; } = [];
    }

    public class UpdateLeaseTemplatePolicyDto
    {
        public long? Id { get; set; } // Null for new items
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}
