namespace brownstone_hub_api.Dtos.Lease
{
    public class MaintenanceResponsibilityDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Responsibility { get; set; } = "Landlord"; // Tenant | Landlord
    }
}
