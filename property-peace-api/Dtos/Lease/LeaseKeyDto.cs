namespace brownstone_hub_api.Dtos.Lease
{
    public class LeaseKeyDto
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public long? OrganizationId { get; set; }
        public string KeyType { get; set; } = "Property";
        public int Copies { get; set; } = 1;
    }
}
