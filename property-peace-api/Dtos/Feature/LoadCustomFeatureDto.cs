namespace brownstone_hub_api.Dtos.Feature
{
    public class LoadCustomFeatureDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public long OrganizationId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
