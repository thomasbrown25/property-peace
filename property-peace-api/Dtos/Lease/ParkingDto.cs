namespace brownstone_hub_api.Dtos.Lease
{
    public class ParkingDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public bool IncludeParkingRules { get; set; }
        public string? ParkingTypes { get; set; } // JSON array: garage, driveway, street, etc.
        public string? CustomRules { get; set; }
    }
}
