namespace brownstone_hub_api.Dtos.Search
{
    public class SearchResultDto
    {
        public List<PropertySearchResultDto> Properties { get; set; } = [];
        public List<TenantSearchResultDto> Tenants { get; set; } = [];
        public List<LeaseSearchResultDto> Leases { get; set; } = [];
    }

    public class PropertySearchResultDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string PropertyType { get; set; } = string.Empty;
    }

    public class TenantSearchResultDto
    {
        public long Id { get; set; }
        public string Firstname { get; set; } = string.Empty;
        public string Lastname { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public long? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public long? UnitId { get; set; }
        public string? UnitName { get; set; }
    }

    public class LeaseSearchResultDto
    {
        public long Id { get; set; }
        public long PropertyId { get; set; }
        public string PropertyName { get; set; } = string.Empty;
        public long UnitId { get; set; }
        public string UnitName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal RentAmount { get; set; }
        public bool IsActive { get; set; }
        public List<string> TenantNames { get; set; } = [];
    }
}

