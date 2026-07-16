namespace brownstone_hub_api.Dtos.LeaseGeneration
{
    public class PlaceholderCatalogDto
    {
        public List<PlaceholderGroupDto> Groups { get; set; } = [];
    }

    public class PlaceholderGroupDto
    {
        public string GroupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<PlaceholderItemDto> Placeholders { get; set; } = [];
    }

    public class PlaceholderItemDto
    {
        public string Key { get; set; } = string.Empty; // e.g., "Tenant.FullNameList"
        public string Placeholder { get; set; } = string.Empty; // e.g., "{{Tenant.FullNameList}}"
        public string Type { get; set; } = "String"; // String, Date, Currency, Number, List
        public string Description { get; set; } = string.Empty;
        public bool IsRequired { get; set; } = false;
        public string? Example { get; set; }
    }
}
