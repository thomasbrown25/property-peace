namespace brownstone_hub_api.Dtos.Lease
{
    public class PetDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string? Breed { get; set; }
        public decimal? Weight { get; set; }
        public int? Age { get; set; }
    }
}
