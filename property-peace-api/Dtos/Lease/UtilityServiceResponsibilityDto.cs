namespace brownstone_hub_api.Dtos.Lease
{
    public class UtilityServiceResponsibilityDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Responsibility { get; set; } = "Tenant"; // Tenant | Landlord
        public bool IsRequired { get; set; }
    }
}
